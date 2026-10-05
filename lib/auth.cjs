const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { query, isConflict } = require('./database.cjs');
const { fail } = require('./http.cjs');
const derive = promisify(scrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password, encoded) {
  const [salt, stored] = encoded.split(':');
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const target = Buffer.from(stored, 'hex');
  return key.length === target.length && timingSafeEqual(key, target);
}
async function rateLimit(key, limit, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  const expires = (bucket + 1) * windowMs;
  await query('DELETE FROM request_limits WHERE expires_at<$1', [Date.now()]);
  const result = await query('INSERT INTO request_limits (key, count, expires_at) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count', [`${key}:${bucket}`, expires]);
  if (result.rows[0].count > limit) fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
}
function setCookie(res, token = '', age = 604800) {
  res.setHeader('Set-Cookie', `agendae_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function sessionToken(req) {
  const token = String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('agendae_session='))?.slice(16);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function currentUser(req, required = true) {
  const token = sessionToken(req);
  if (token) {
    const result = await query('SELECT users.id, users.name, users.email FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token_hash=$1 AND sessions.expires_at>$2', [hash(token), Date.now()]);
    if (result.rows[0]) return result.rows[0];
  }
  if (required) fail(401, 'Entre na sua conta para continuar.');
  return null;
}
async function createSession(res, user) {
  const token = randomBytes(32).toString('hex');
  await query('DELETE FROM sessions WHERE expires_at<$1', [Date.now()]);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [hash(token), user.id, Date.now() + 604800000]);
  setCookie(res, token);
  return { id: user.id, name: user.name, email: user.email };
}
async function credentials(req, res) {
  const { action, name, email, password, consent } = req.body || {};
  if (!['login', 'register', 'logout'].includes(action)) fail(422, 'Ação inválida.');
  if (action === 'logout') {
    const token = sessionToken(req);
    if (token) await query('DELETE FROM sessions WHERE token_hash=$1', [hash(token)]);
    setCookie(res, '', 0); return { user: null };
  }
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 128) fail(422, 'Informe um e-mail válido e uma senha entre 8 e 128 caracteres.');
  const normalized = email.trim().toLowerCase();
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0];
  await rateLimit(`auth-ip:${hash(ip)}`, 30, 900000);
  await rateLimit(`auth-email:${hash(normalized)}`, 10, 900000);
  if (action === 'register') {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || consent !== true) fail(422, 'Informe seu nome e aceite o uso dos dados para sua conta.');
    const user = { id: randomUUID(), name: name.trim(), email: normalized };
    try { await query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)', [user.id, user.name, user.email, await passwordHash(password), Date.now()]); }
    catch (error) { if (isConflict(error)) fail(409, 'Não foi possível criar a conta com este e-mail. Tente entrar.'); throw error; }
    return { user: await createSession(res, user) };
  }
  const result = await query('SELECT * FROM users WHERE email=$1', [normalized]);
  const user = result.rows[0];
  const encoded = user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64);
  const matches = await passwordMatches(password, encoded);
  if (!user || !matches) fail(401, 'E-mail ou senha incorretos.');
  return { user: await createSession(res, user) };
}
module.exports = { credentials, currentUser, rateLimit, passwordHash, passwordMatches };
