const { randomUUID } = require('node:crypto');
const { currentUser, rateLimit } = require('../lib/auth.cjs');
const { endpoint, requireMethod } = require('../lib/http.cjs');
const { triage, validateInput } = require('../lib/triage.cjs');
const { getStore } = require('../lib/store.cjs');
const TTL = 30 * 86400000;
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['POST']);
  const user = await currentUser(req);
  await rateLimit(`triage:${user.id}`, 5, 3600000);
  const result = await triage(req.body);
  if (req.body?.share !== true) return res.status(200).json(result);
  // Com consentimento, a pré-triagem fica disponível para a unidade em que o paciente agendar.
  const input = validateInput(req.body);
  const id = randomUUID(); const now = Date.now();
  await getStore().saveTriage({ id, userId: user.id, createdAt: now, expiresAt: now + TTL, data: { ...input, specialty: result.specialty, confidence: result.confidence, urgent: result.urgent, source: result.source, createdAt: now } });
  return res.status(200).json({ ...result, triageId: id });
});
