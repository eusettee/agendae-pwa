const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SQLITE_PATH = ':memory:';
const server = require('../server.cjs');
test('Expo: autenticação Bearer compartilha CRUD, isola contas e revoga sessão', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const request = (path, method = 'GET', body, token, headers = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  try {
    const response = await request('mobile-auth', 'POST', { action: 'register', name: 'Paciente Expo', email: 'expo@example.test', password: 'senha-teste-123', consent: true });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('set-cookie'), null);
    const { user, token } = await response.json();
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal((await (await request('mobile-auth', 'GET', null, token)).json()).user.id, user.id);
    const input = { clinicId: 'boa-vista', professionalId: 'ana', date: '2099-10-05', time: '09:00' };
    const saved = await request('appointments', 'POST', input, token);
    assert.equal(saved.status, 201);
    const { appointment } = await saved.json();
    const login = await request('auth', 'POST', { action: 'login', email: 'expo@example.test', password: 'senha-teste-123' });
    const web = await login.json();
    assert.equal(web.token, undefined);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await request('appointments', 'GET', null, null, { Cookie: cookie })).json()).appointments[0].id, appointment.id);
    const other = await (await request('mobile-auth', 'POST', { action: 'register', name: 'Outra Conta', email: 'other-expo@example.test', password: 'senha-teste-123', consent: true })).json();
    assert.equal((await request('appointments', 'DELETE', { id: appointment.id }, other.token)).status, 404);
    assert.equal((await request('appointments', 'PUT', { ...input, id: appointment.id, time: '10:00' }, token)).status, 200);
    assert.equal((await request('appointments', 'DELETE', { id: appointment.id }, token)).status, 200);
    assert.equal((await request('mobile-auth', 'POST', { action: 'logout' }, token)).status, 200);
    assert.equal((await request('appointments', 'GET', null, token)).status, 401);
    assert.equal((await request('mobile-auth', 'GET', null, 'invalid')).status, 401);
    assert.equal((await request('mobile-auth', 'POST', { action: 'login' }, null, { Origin: 'https://other.example' })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
