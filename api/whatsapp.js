// Gateway do canal WhatsApp: verificação da Meta (GET) e mensagens assinadas (POST).
const { readRawBody } = require('../lib/http.cjs');
const { validSignature, verifyChallenge, extractMessages, sendText } = require('../lib/integration/whatsapp.cjs');
const { reply } = require('../lib/integration/chatbot.cjs');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const json = (code, value) => res.status(code).json(value);
  try {
    if (req.method === 'GET') {
      const challenge = verifyChallenge(new URL(req.url, 'http://localhost').searchParams);
      if (!challenge) return json(403, { error: 'Verificação recusada.' });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.statusCode = 200; return res.end(challenge);
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(405, { error: 'Método não permitido.' }); }
    if (!process.env.WHATSAPP_APP_SECRET) return json(503, { error: 'Canal WhatsApp não configurado.' });
    const raw = await readRawBody(req);
    if (!validSignature(raw, req.headers['x-hub-signature-256'])) return json(401, { error: 'Assinatura inválida.' });
    let payload; try { payload = JSON.parse(raw); } catch { return json(400, { error: 'JSON inválido.' }); }
    const messages = extractMessages(payload).slice(0, 10);
    let sent = 0;
    for (const message of messages) {
      const answer = await reply({ text: message.text, from: message.from, channel: 'whatsapp' });
      try { if (await sendText(message.from, answer.reply)) sent++; } catch { /* A Meta reenvia eventos; não expomos o erro. */ }
    }
    // A Meta espera 200 rapidamente; eventos de status (entregue/lido) são apenas confirmados.
    return json(200, { received: messages.length, sent });
  } catch {
    return json(200, { received: 0, sent: 0 });
  }
};
