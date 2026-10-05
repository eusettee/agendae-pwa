const { randomUUID } = require('node:crypto');
const { validateAppointment } = require('../lib/appointment.cjs');
const { query, isConflict } = require('../lib/database.cjs');
const { currentUser } = require('../lib/auth.cjs');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const fields = 'id, patient, clinic_id AS "clinicId", professional_id AS "professionalId", date, time';
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST', 'PUT', 'DELETE']);
  const user = await currentUser(req);
  if (req.method === 'GET') {
    const result = await query(`SELECT ${fields} FROM appointments WHERE user_id=$1 ORDER BY date,time`, [user.id]);
    return res.status(200).json({ appointments: result.rows });
  }
  const input = req.body || {};
  if (req.method === 'PUT' || req.method === 'DELETE') {
    if (typeof input.id !== 'string') fail(422, 'Consulta inválida.');
    const existing = await query('SELECT id FROM appointments WHERE id=$1 AND user_id=$2', [input.id, user.id]);
    if (!existing.rows.length) fail(404, 'Consulta não encontrada.');
  }
  if (req.method === 'DELETE') {
    await query('DELETE FROM appointments WHERE id=$1 AND user_id=$2', [input.id, user.id]);
    return res.status(200).json({ deleted: true });
  }
  const data = { ...input, patient: user.name };
  const error = validateAppointment(data);
  if (error) fail(422, error);
  const id = req.method === 'POST' ? randomUUID() : input.id;
  const values = [data.clinicId, data.professionalId, data.date, data.time, id, user.id];
  try {
    if (req.method === 'POST') await query('INSERT INTO appointments (clinic_id,professional_id,date,time,id,user_id,patient,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [...values, user.name, Date.now()]);
    else {
      const updated = await query('UPDATE appointments SET clinic_id=$1,professional_id=$2,date=$3,time=$4 WHERE id=$5 AND user_id=$6', values);
      if (!updated.rowCount) fail(404, 'Consulta não encontrada.');
    }
  } catch (error) { if (isConflict(error)) fail(409, 'Este horário já está ocupado. Escolha outro.'); throw error; }
  return res.status(req.method === 'POST' ? 201 : 200).json({ appointment: { id, patient: user.name, clinicId: data.clinicId, professionalId: data.professionalId, date: data.date, time: data.time } });
});
