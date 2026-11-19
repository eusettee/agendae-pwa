// Canal do simulador do WhatsApp no app.
// Com N8N_WEBHOOK_URL, a mensagem segue o caminho real: app → n8n → /api/gateway → n8n → app.
// Sem n8n (ou se ele não responder), o backend atende diretamente com o mesmo fluxo.
const { createHash } = require('node:crypto');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const { rateLimit } = require('../lib/auth.cjs');
const { reply } = require('../lib/integration/chatbot.cjs');
async function viaN8n(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.reply === 'string' ? { ...data, via: 'n8n' } : null;
  } catch { return null; }
}
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['POST']);
  const { text, sessionId } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail(422, 'Escreva uma mensagem de até 1000 caracteres.');
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId)) fail(422, 'Sessão do simulador inválida. Recarregue a página.');
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0];
  await rateLimit(`chat-ip:${createHash('sha256').update(ip).digest('hex')}`, 3000, 600000);
  // O "telefone" do simulador é um identificador aleatório da aba, nunca dados pessoais.
  const from = 'site-' + createHash('sha256').update(sessionId).digest('hex').slice(0, 24);
  const forwarded = await viaN8n({ channel: 'site', from, text });
  if (forwarded) return res.status(200).json(forwarded);
  return res.status(200).json({ channel: 'site', via: 'direto', ...(await reply({ text, from, channel: 'site' })) });
});
