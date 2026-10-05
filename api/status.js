const { endpoint, requireMethod } = require('../lib/http.cjs');
const { firebaseConfigured } = require('../lib/firebase.cjs');
module.exports = endpoint((req, res) => {
  requireMethod(req, res, ['GET']);
  res.status(200).json({ accounts: firebaseConfigured() || !process.env.VERCEL, database: firebaseConfigured() ? 'firestore' : process.env.VERCEL ? 'unconfigured' : 'sqlite', ai: Boolean(process.env.OPENAI_API_KEY) });
});
