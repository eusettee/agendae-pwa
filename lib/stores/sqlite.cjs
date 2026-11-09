const { query, isConflict } = require('../database.cjs');
const { fail } = require('../http.cjs');
const fields = 'id, patient, clinic_id AS "clinicId", professional_id AS "professionalId", date, time, status, triage_id AS "triageId"';
const userFields = 'users.id, users.name, users.email, users.role, users.clinic_id AS "clinicId", users.professional_id AS "professionalId", users.cpf_masked AS "cpfMasked"';
const clean = item => { if (!item) return item; if (item.triageId === null) delete item.triageId; return item; };
async function editable(id, userId) {
  const row = (await query('SELECT status FROM appointments WHERE id=$1 AND user_id=$2', [id, userId])).rows[0];
  if (!row) fail(404, 'Consulta não encontrada.');
  if (row.status !== 'agendada') fail(409, 'Esta consulta já foi registrada pela unidade e não pode ser alterada.');
}
module.exports = {
  async createUser(user) {
    try { await query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)', [user.id,user.name,user.email,user.passwordHash,user.createdAt]); }
    catch (error) { if (isConflict(error)) fail(409, 'Não foi possível criar a conta com este e-mail. Tente entrar.'); throw error; }
  },
  async userByEmail(email) { return (await query(`SELECT ${userFields}, users.password_hash AS "passwordHash" FROM users WHERE email=$1`, [email])).rows[0] || null; },
  async sessionUser(hash, now) { return (await query(`SELECT ${userFields} FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token_hash=$1 AND sessions.expires_at>$2`, [hash,now])).rows[0] || null; },
  async createSession(hash,userId,expiresAt) {
    await query('DELETE FROM sessions WHERE expires_at<$1', [Date.now()]);
    await query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash,userId,expiresAt]);
  },
  async deleteSession(hash) { await query('DELETE FROM sessions WHERE token_hash=$1',[hash]); },
  async incrementLimit(key,expiresAt) {
    await query('DELETE FROM request_limits WHERE expires_at<$1',[Date.now()]);
    return (await query('INSERT INTO request_limits (key,count,expires_at) VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=request_limits.count+1 RETURNING count',[key,expiresAt])).rows[0].count;
  },
  async setStaffRole(userId, { role, clinicId, professionalId }) {
    try { await query('UPDATE users SET role=$1, clinic_id=$2, professional_id=$3 WHERE id=$4', [role, clinicId, professionalId, userId]); }
    catch (error) { if (isConflict(error)) fail(409, 'Este profissional já possui uma conta ativa no painel.'); throw error; }
  },
  async setCpf(userId, cpfHash, cpfMasked) {
    try { await query('UPDATE users SET cpf_hash=$1, cpf_masked=$2 WHERE id=$3', [cpfHash, cpfMasked, userId]); }
    catch (error) { if (isConflict(error)) fail(409, 'Este CPF já está vinculado a outra conta.'); throw error; }
  },
  async userByCpf(cpfHash) { return (await query('SELECT id, name, cpf_masked AS "cpfMasked" FROM users WHERE cpf_hash=$1', [cpfHash])).rows[0] || null; },
  async listAppointments(userId) { return (await query(`SELECT ${fields} FROM appointments WHERE user_id=$1 ORDER BY date,time`,[userId])).rows.map(clean); },
  async listAgenda(scope, date) {
    const [column, value] = scope.professionalId ? ['professional_id', scope.professionalId] : ['clinic_id', scope.clinicId];
    return (await query(`SELECT ${fields}, user_id AS "userId" FROM appointments WHERE ${column}=$1 AND date=$2 ORDER BY time`, [value, date])).rows.map(clean);
  },
  async getAppointment(id) { return clean((await query(`SELECT ${fields}, user_id AS "userId" FROM appointments WHERE id=$1`, [id])).rows[0] || null); },
  async updateStatus(id, from, to) {
    if (!(await query('UPDATE appointments SET status=$1 WHERE id=$2 AND status=$3', [to, id, from])).rowCount) fail(409, 'A consulta foi alterada. Atualize o painel.');
  },
  async occupied(professionalId,date) { return (await query('SELECT time FROM appointments WHERE professional_id=$1 AND date=$2',[professionalId,date])).rows.map(row=>row.time); },
  async saveAppointment(item,userId,creating) {
    try {
      if (creating) await query('INSERT INTO appointments (clinic_id,professional_id,date,time,id,user_id,patient,created_at,status,triage_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[item.clinicId,item.professionalId,item.date,item.time,item.id,userId,item.patient,Date.now(),'agendada',item.triageId || null]);
      else {
        await editable(item.id, userId);
        await query('UPDATE appointments SET clinic_id=$1,professional_id=$2,date=$3,time=$4,triage_id=COALESCE($7,triage_id) WHERE id=$5 AND user_id=$6',[item.clinicId,item.professionalId,item.date,item.time,item.id,userId,item.triageId || null]);
      }
    } catch(error) { if(isConflict(error)) fail(409,'Este horário já está ocupado. Escolha outro.'); throw error; }
  },
  async deleteAppointment(id,userId) { await editable(id, userId); await query('DELETE FROM appointments WHERE id=$1 AND user_id=$2',[id,userId]); },
  async saveTriage(triage) {
    await query('DELETE FROM triages WHERE expires_at<$1', [Date.now()]);
    await query('INSERT INTO triages (id,user_id,data,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)', [triage.id, triage.userId, JSON.stringify(triage.data), triage.createdAt, triage.expiresAt]);
  },
  async getTriage(id) {
    const row = (await query('SELECT user_id AS "userId", data, expires_at AS "expiresAt" FROM triages WHERE id=$1', [id])).rows[0];
    return row && row.expiresAt > Date.now() ? { userId: row.userId, data: JSON.parse(row.data) } : null;
  },
  async getConversation(key) {
    const row = (await query('SELECT state, expires_at AS "expiresAt" FROM conversations WHERE key=$1', [key])).rows[0];
    return row && row.expiresAt > Date.now() ? JSON.parse(row.state) : null;
  },
  async saveConversation(key, state, expiresAt) {
    await query('DELETE FROM conversations WHERE expires_at<$1', [Date.now()]);
    await query('INSERT INTO conversations (key,state,expires_at) VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET state=excluded.state, expires_at=excluded.expires_at', [key, JSON.stringify(state), expiresAt]);
  },
  async audit(entry) { await query('INSERT INTO audit_log (action,actor_id,role,target_id,at) VALUES ($1,$2,$3,$4,$5)', [entry.action, entry.actorId, entry.role, entry.targetId, entry.at]); }
};
