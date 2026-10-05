const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { getStore } = require('./store.cjs');
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
  const count = await getStore().incrementLimit(`${key}:${bucket}`, expires);
  if (count > limit) fail(429, 'Muitas tentativas. Aguarde alguns minutos.');
}
function setCookie(res, token = '', age = 604800) {
  res.setHeader('Set-Cookie', `agendae_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function sessionToken(req) {
  if (req.headers.authorization) {
    const bearer = /^Bearer ([a-f0-9]{64})$/.exec(String(req.headers.authorization));
    return bearer ? bearer[1] : null;
  }
  const token = String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('agendae_session='))?.slice(16);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function currentUser(req, required = true) {
  const token = sessionToken(req);
  if (token) {
    const user = await getStore().sessionUser(hash(token), Date.now());
    if (user) return user;
  }
  if (required) fail(401, 'Entre na sua conta para continuar.');
  return null;
}
async function createSession(res, user, mobile = false) {
  const token = randomBytes(32).toString('hex');
  await getStore().createSession(hash(token), user.id, Date.now() + 604800000);
  const account = { id: user.id, name: user.name, email: user.email };
  if (mobile) return { user: account, token };
  setCookie(res, token);
  return { user: account };
}
async function credentials(req, res, mobile = false) {
  const { action, name, email, password, consent } = req.body || {};
  if (!['login', 'register', 'logout'].includes(action)) fail(422, 'Ação inválida.');
  if (action === 'logout') {
    const token = sessionToken(req);
    if (token) await getStore().deleteSession(hash(token));
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
    await getStore().createUser({ ...user, passwordHash: await passwordHash(password), createdAt: Date.now() });
    return createSession(res, user, mobile);
  }
  const user = await getStore().userByEmail(normalized);
  const encoded = user?.passwordHash || '00000000000000000000000000000000:' + '00'.repeat(64);
  const matches = await passwordMatches(password, encoded);
  if (!user || !matches) fail(401, 'E-mail ou senha incorretos.');
  return createSession(res, user, mobile);
}
module.exports = { credentials, currentUser, rateLimit, passwordHash, passwordMatches };
