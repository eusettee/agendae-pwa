const { randomUUID } = require('node:crypto');
const { validateAppointment } = require('../lib/appointment.cjs');
const { getStore } = require('../lib/store.cjs');
const { currentUser } = require('../lib/auth.cjs');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST', 'PUT', 'DELETE']);
  const user = await currentUser(req);
  if (req.method === 'GET') {
    return res.status(200).json({ appointments: await getStore().listAppointments(user.id) });
  }
  const input = req.body || {};
  if (req.method === 'PUT' || req.method === 'DELETE') {
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.id)) fail(422, 'Consulta inválida.');
  }
  if (req.method === 'DELETE') {
    await getStore().deleteAppointment(input.id, user.id);
    return res.status(200).json({ deleted: true });
  }
  const data = { ...input, patient: user.name };
  const error = validateAppointment(data);
  if (error) fail(422, error);
  const id = req.method === 'POST' ? randomUUID() : input.id;
  const appointment = { id, patient: user.name, clinicId: data.clinicId, professionalId: data.professionalId, date: data.date, time: data.time };
  await getStore().saveAppointment(appointment, user.id, req.method === 'POST');
  return res.status(req.method === 'POST' ? 201 : 200).json({ appointment });
});
