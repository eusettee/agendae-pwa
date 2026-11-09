// Canal "site": simulador de conversa no app, usando o mesmo atendimento do gateway WhatsApp.
const { createHash } = require('node:crypto');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const { rateLimit } = require('../lib/auth.cjs');
const { reply } = require('../lib/integration/chatbot.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['POST']);
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail(422, 'Escreva uma mensagem de até 1000 caracteres.');
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0];
  const from = 'site:' + createHash('sha256').update(ip).digest('hex').slice(0, 32);
  await rateLimit(`chat:${from}`, 40, 600000);
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const url = /^[\w.-]+(:\d+)?$/.test(host) ? `${req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? 'https' : 'http'}://${host}` : undefined;
  return res.status(200).json({ channel: 'site', ...(await reply({ text, from, channel: 'site', appUrl: url })) });
});
