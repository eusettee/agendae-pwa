const { randomUUID } = require('node:crypto');
const { validateAppointment } = require('../lib/appointment.cjs');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido.' }); }
  const error = validateAppointment(req.body);
  if (error) return res.status(422).json({ error });
  return res.status(200).json({ id: randomUUID(), validated: true, demo: true });
};
