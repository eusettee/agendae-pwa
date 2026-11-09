const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const { credentials, currentUser } = require('../lib/auth.cjs');
const { getStore } = require('../lib/store.cjs');
const { protectCpf } = require('../lib/rules.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST']);
  if (req.method === 'GET') return res.status(200).json({ user: await currentUser(req, false) });
  if (req.body?.action === 'profile') {
    // CPF opcional para a recepção localizar a consulta; null remove.
    const user = await currentUser(req);
    const { cpf, consent } = req.body;
    if (cpf !== null && consent !== true) fail(422, 'Autorize o uso do CPF para identificação na recepção.');
    const data = cpf === null ? { cpfHash: null, cpfMasked: null } : protectCpf(cpf);
    await getStore().setCpf(user.id, data.cpfHash, data.cpfMasked);
    return res.status(200).json({ user: { ...user, cpfMasked: data.cpfMasked } });
  }
  return res.status(req.body?.action === 'register' ? 201 : 200).json(await credentials(req, res));
});
