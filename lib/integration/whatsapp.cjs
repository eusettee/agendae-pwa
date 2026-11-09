// Adaptador da WhatsApp Cloud API (Meta): assinatura, leitura do webhook e envio de texto.
const { createHmac, createHash, timingSafeEqual } = require('node:crypto');

function safeEqual(a, b) {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right) && String(a).length === String(b).length;
}
function validSignature(rawBody, header, secret = process.env.WHATSAPP_APP_SECRET) {
  if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  return safeEqual(header, 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'));
}
function verifyChallenge(params, token = process.env.WHATSAPP_VERIFY_TOKEN) {
  if (!token || params.get('hub.mode') !== 'subscribe' || !safeEqual(params.get('hub.verify_token') || '', token)) return null;
  const challenge = params.get('hub.challenge') || '';
  return /^[\w-]{1,128}$/.test(challenge) ? challenge : null;
}
function extractMessages(payload) {
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];
  return payload.entry.flatMap(entry => entry.changes || []).filter(change => change.field === 'messages')
    .flatMap(change => change.value?.messages || [])
    .filter(message => typeof message?.from === 'string' && /^\d{6,20}$/.test(message.from))
    .map(message => ({ id: message.id, from: message.from, text: message.type === 'text' ? String(message.text?.body || '') : message.type === 'interactive' ? String(message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '') : '' }));
}
const sendingConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
async function sendText(to, body, request = fetch) {
  if (!sendingConfigured()) return false;
  const version = /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || '') ? process.env.WHATSAPP_GRAPH_VERSION : 'v23.0';
  const response = await request(`https://graph.facebook.com/${version}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: body.slice(0, 4096) } })
  });
  return response.ok;
}
module.exports = { validSignature, verifyChallenge, extractMessages, sendText, sendingConfigured, safeEqual };
