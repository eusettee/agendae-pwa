const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
process.env.SQLITE_PATH = ':memory:';
delete process.env.OPENAI_API_KEY;
const { reply } = require('../lib/integration/chatbot.cjs');
const { validSignature, verifyChallenge, extractMessages } = require('../lib/integration/whatsapp.cjs');
const server = require('../server.cjs');
test('atendimento: menu, hospitais, urgência, horários e pré-triagem sem chave', async () => {
  assert.equal((await reply({ text: 'oi', from: 'teste' })).intent, 'menu');
  assert.match((await reply({ text: '2 derby', from: 'teste' })).reply, /Restauração/);
  assert.equal((await reply({ text: 'estou com dor no peito', from: 'teste' })).intent, 'urgencia');
  assert.match((await reply({ text: 'horarios ana 2099-10-05', from: 'teste' })).reply, /08:00/);
  assert.match((await reply({ text: 'triagem dor no joelho há dois dias', from: 'teste' })).reply, /Ortopedia[\s\S]*Unidade Boa Vista/);
});
test('WhatsApp: assinatura HMAC, desafio de verificação e leitura de mensagens', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messages: [{ id: 'm1', from: '5581999990000', type: 'text', text: { body: 'oi' } }] } }] }] });
  const signature = 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex');
  assert.equal(validSignature(body, signature, 'segredo'), true);
  assert.equal(validSignature(body + ' ', signature, 'segredo'), false);
  assert.equal(verifyChallenge(new URLSearchParams('hub.mode=subscribe&hub.verify_token=abc&hub.challenge=123'), 'abc'), '123');
  assert.equal(verifyChallenge(new URLSearchParams('hub.mode=subscribe&hub.verify_token=x&hub.challenge=123'), 'abc'), null);
  assert.deepEqual(extractMessages(JSON.parse(body)), [{ id: 'm1', from: '5581999990000', text: 'oi' }]);
});
test('rotas: chat do app, gateway com token e webhook assinado', async () => {
  process.env.GATEWAY_TOKEN = 'token-de-teste-com-mais-de-24-caracteres';
  process.env.WHATSAPP_APP_SECRET = 'segredo';
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    const chat = await fetch(base + 'chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '1' }) });
    assert.equal((await chat.json()).intent, 'especialidades');
    const gateway = (token) => fetch(base + 'gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ channel: 'n8n', from: 'teste', text: '5' }) });
    assert.equal((await gateway('errado')).status, 401);
    assert.equal((await (await gateway(process.env.GATEWAY_TOKEN)).json()).intent, 'canais');
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    assert.equal((await fetch(base + 'whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=00' }, body })).status, 401);
    const signed = await fetch(base + 'whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex') }, body });
    assert.equal(signed.status, 200);
  } finally {
    delete process.env.GATEWAY_TOKEN; delete process.env.WHATSAPP_APP_SECRET;
    await new Promise(resolve => server.close(resolve));
  }
});
