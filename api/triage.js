const { currentUser, rateLimit } = require('../lib/auth.cjs');
const { endpoint, requireMethod } = require('../lib/http.cjs');
const { triage } = require('../lib/triage.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['POST']);
  const user = await currentUser(req);
  await rateLimit(`triage:${user.id}`, 5, 3600000);
  return res.status(200).json(await triage(req.body));
});
