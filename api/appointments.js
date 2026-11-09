const { randomUUID } = require('node:crypto');
const { validateAppointment } = require('../lib/appointment.cjs');
const { getStore } = require('../lib/store.cjs');
const { currentUser } = require('../lib/auth.cjs');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST', 'PUT', 'DELETE']);
  const user = await currentUser(req);
  const store = getStore();
  if (req.method === 'GET') {
    return res.status(200).json({ appointments: (await store.listAppointments(user.id)).map(item => ({ ...item, status: item.status || 'agendada' })) });
  }
  const input = req.body || {};
  if ((req.method === 'PUT' || req.method === 'DELETE') && !validId(input.id)) fail(422, 'Consulta inválida.');
  if (req.method === 'DELETE') {
    await store.deleteAppointment(input.id, user.id);
    return res.status(200).json({ deleted: true });
  }
  const data = { ...input, patient: user.name };
  const error = validateAppointment(data);
  if (error) fail(422, error);
  let triageId;
  if (input.triageId !== undefined && input.triageId !== null) {
    // Só a pré-triagem da própria conta pode ser anexada.
    const triage = validId(input.triageId) ? await store.getTriage(input.triageId) : null;
    if (!triage || triage.userId !== user.id) fail(422, 'Pré-triagem inválida ou expirada.');
    triageId = input.triageId;
  }
  const id = req.method === 'POST' ? randomUUID() : input.id;
  const appointment = { id, patient: user.name, clinicId: data.clinicId, professionalId: data.professionalId, date: data.date, time: data.time, status: 'agendada', ...(triageId ? { triageId } : {}) };
  await store.saveAppointment(appointment, user.id, req.method === 'POST');
  return res.status(req.method === 'POST' ? 201 : 200).json({ appointment });
});
