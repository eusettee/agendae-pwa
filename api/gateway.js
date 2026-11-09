// Gateway para automações (n8n) e outros canais: token de serviço no cabeçalho Authorization.
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const { safeEqual } = require('../lib/integration/whatsapp.cjs');
const { reply } = require('../lib/integration/chatbot.cjs');
const CHANNELS = ['whatsapp', 'telegram', 'site', 'n8n', 'teste'];
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['POST']);
  const token = process.env.GATEWAY_TOKEN;
  if (!token || token.length < 24) fail(503, 'Gateway não configurado.');
  const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''))?.[1] || '';
  if (!safeEqual(bearer, token)) fail(401, 'Token do gateway inválido.');
  const { channel = 'n8n', from = 'anonimo', text } = req.body || {};
  if (!CHANNELS.includes(channel) || typeof from !== 'string' || from.length > 64 || typeof text !== 'string' || text.length > 1000) fail(422, 'Informe channel, from (até 64) e text (até 1000 caracteres).');
  const answer = await reply({ text, from, channel });
  return res.status(200).json({ channel, to: from, ...answer });
});
