const { endpoint, requireMethod } = require('../lib/http.cjs');
const { credentials, currentUser } = require('../lib/auth.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST']);
  if (req.method === 'GET') return res.status(200).json({ user: await currentUser(req, false) });
  return res.status(req.body?.action === 'register' ? 201 : 200).json(await credentials(req, res));
});
