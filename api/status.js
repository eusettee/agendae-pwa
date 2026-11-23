const { endpoint, requireMethod } = require('../lib/http.cjs');
const { firebaseConfigured } = require('../lib/firebase.cjs');
module.exports = endpoint((req, res) => {
  requireMethod(req, res, ['GET']);
  res.status(200).json({ accounts: firebaseConfigured() || !process.env.VERCEL, database: firebaseConfigured() ? 'firestore' : process.env.VERCEL ? 'unconfigured' : 'sqlite', ai: Boolean(process.env.OPENAI_API_KEY), chat: true, whatsapp: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN), gateway: Boolean(process.env.GATEWAY_TOKEN) });
}, { cors: true });
