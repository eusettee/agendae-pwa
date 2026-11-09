const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
process.env.SQLITE_PATH = ':memory:';
delete process.env.OPENAI_API_KEY;
delete process.env.N8N_WEBHOOK_URL;
const { reply } = require('../lib/integration/chatbot.cjs');
const { validSignature, verifyChallenge, extractMessages } = require('../lib/integration/whatsapp.cjs');
const server = require('../server.cjs');
const CPF = '52998224725';

test('WhatsApp: conversa completa agenda, consulta e cancela pelo CPF', async () => {
  const phone = '5581999990001';
  const say = text => reply({ text, from: phone, channel: 'whatsapp' });
  assert.match((await say('oi')).reply, /Agendar consulta/);
  assert.match((await say('1')).reply, /LGPD/);
  assert.match((await say('1')).reply, /CPF/);
  assert.match((await say('123')).reply, /CPF inválido/);
  assert.match((await say(CPF)).reply, /nome completo/);
  assert.match((await say('Maria Fictícia Souza')).reply, /O que você está sentindo/);
  assert.match((await say('dor no joelho ao subir escadas')).reply, /quanto tempo/);
  assert.match((await say('há uma semana')).reply, /intensidade/);
  const suggestion = await say('2');
  assert.match(suggestion.reply, /Ortopedia/);
  assert.equal(suggestion.buttons[0].value, '1');
  assert.match((await say('1')).reply, /Dr\. Pedro Costa — Unidade Boa Vista/);
  assert.match((await say('1')).reply, /Escolha a \*data\*/);
  assert.match((await say('2')).reply, /Horários livres/);
  assert.match((await say('1')).reply, /Confira sua consulta[\s\S]*Pré-triagem anexada/);
  const confirmed = await say('1');
  assert.match(confirmed.reply, /Consulta confirmada[\s\S]*AGD-/);
  // Mesmo CPF em outro telefone: reconhece o paciente e lista a consulta.
  const other = text => reply({ text, from: '5581999990002', channel: 'whatsapp' });
  await other('oi');
  assert.match((await other('2')).reply, /CPF/);
  const list = await other(CPF);
  assert.match(list.reply, /Suas consultas[\s\S]*Ortopedia/);
  assert.match((await other('1')).reply, /Cancelar a consulta/);
  assert.match((await other('1')).reply, /cancelada/);
  // Urgência interrompe o fluxo.
  await say('0'); await say('1'); await say('1');
  assert.equal((await say('estou com dor no peito e falta de ar')).intent, 'urgencia');
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

test('rotas: simulador, gateway do n8n com token e webhook assinado', async () => {
  process.env.GATEWAY_TOKEN = 'token-de-teste-com-mais-de-24-caracteres';
  process.env.WHATSAPP_APP_SECRET = 'segredo';
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const json = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const sessionId = crypto.randomUUID();
    const chat = await (await json('chat', { text: 'oi', sessionId })).json();
    assert.equal(chat.via, 'direto'); assert.equal(chat.intent, 'menu');
    assert.equal((await json('chat', { text: 'oi' })).status, 422);
    assert.equal((await json('gateway', { channel: 'whatsapp', from: '5581988887777', text: 'oi' }, { Authorization: 'Bearer errado' })).status, 401);
    const gateway = await (await json('gateway', { channel: 'whatsapp', from: '5581988887777', text: 'oi' }, { Authorization: `Bearer ${process.env.GATEWAY_TOKEN}` })).json();
    assert.equal(gateway.via, 'n8n'); assert.match(gateway.reply, /Agendar consulta/);
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    assert.equal((await fetch(base + 'whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=00' }, body })).status, 401);
    const signed = await fetch(base + 'whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', 'segredo').update(body).digest('hex') }, body });
    assert.equal(signed.status, 200);
  } finally {
    delete process.env.GATEWAY_TOKEN; delete process.env.WHATSAPP_APP_SECRET;
    await new Promise(resolve => server.close(resolve));
  }
});
