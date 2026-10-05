const { query, isConflict } = require('../database.cjs');
const { fail } = require('../http.cjs');
const fields = 'id, patient, clinic_id AS "clinicId", professional_id AS "professionalId", date, time';
module.exports = {
  async createUser(user) {
    try { await query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)', [user.id,user.name,user.email,user.passwordHash,user.createdAt]); }
    catch (error) { if (isConflict(error)) fail(409, 'Não foi possível criar a conta com este e-mail. Tente entrar.'); throw error; }
  },
  async userByEmail(email) { return (await query('SELECT id,name,email,password_hash AS "passwordHash" FROM users WHERE email=$1', [email])).rows[0] || null; },
  async sessionUser(hash, now) { return (await query('SELECT users.id,users.name,users.email FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token_hash=$1 AND sessions.expires_at>$2', [hash,now])).rows[0] || null; },
  async createSession(hash,userId,expiresAt) {
    await query('DELETE FROM sessions WHERE expires_at<$1', [Date.now()]);
    await query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash,userId,expiresAt]);
  },
  async deleteSession(hash) { await query('DELETE FROM sessions WHERE token_hash=$1',[hash]); },
  async incrementLimit(key,expiresAt) {
    await query('DELETE FROM request_limits WHERE expires_at<$1',[Date.now()]);
    return (await query('INSERT INTO request_limits (key,count,expires_at) VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count',[key,expiresAt])).rows[0].count;
  },
  async listAppointments(userId) { return (await query(`SELECT ${fields} FROM appointments WHERE user_id=$1 ORDER BY date,time`,[userId])).rows; },
  async occupied(professionalId,date) { return (await query('SELECT time FROM appointments WHERE professional_id=$1 AND date=$2',[professionalId,date])).rows.map(row=>row.time); },
  async saveAppointment(item,userId,creating) {
    const values=[item.clinicId,item.professionalId,item.date,item.time,item.id,userId];
    try {
      if(creating) await query('INSERT INTO appointments (clinic_id,professional_id,date,time,id,user_id,patient,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[...values,item.patient,Date.now()]);
      else if(!(await query('UPDATE appointments SET clinic_id=$1,professional_id=$2,date=$3,time=$4 WHERE id=$5 AND user_id=$6',values)).rowCount) fail(404,'Consulta não encontrada.');
    } catch(error) { if(isConflict(error)) fail(409,'Este horário já está ocupado. Escolha outro.'); throw error; }
  },
  async deleteAppointment(id,userId) { if(!(await query('DELETE FROM appointments WHERE id=$1 AND user_id=$2',[id,userId])).rowCount) fail(404,'Consulta não encontrada.'); }
};
