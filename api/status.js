const { endpoint, requireMethod } = require('../lib/http.cjs');
module.exports = endpoint((req, res) => {
  requireMethod(req, res, ['GET']);
  res.status(200).json({ accounts: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || !process.env.VERCEL), ai: Boolean(process.env.OPENAI_API_KEY) });
});
