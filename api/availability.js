const { getStore } = require('../lib/store.cjs');
const { currentUser } = require('../lib/auth.cjs');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const catalog = require('../lib/catalog.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET']); await currentUser(req);
  const params = new URL(req.url, 'http://localhost').searchParams;
  const professional = params.get('professionalId'); const date = params.get('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !catalog.clinics.some(clinic => clinic.professionals.some(item => item.id === professional))) fail(422, 'Profissional ou data inválidos.');
  return res.status(200).json({ occupied: await getStore().occupied(professional, date) });
});
