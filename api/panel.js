// Painel da unidade: ativação da equipe, agenda do dia, busca por CPF e situação da consulta.
const { getStore } = require('../lib/store.cjs');
const { currentUser, rateLimit } = require('../lib/auth.cjs');
const { endpoint, fail, requireMethod } = require('../lib/http.cjs');
const { safeEqual } = require('../lib/integration/whatsapp.cjs');
const rules = require('../lib/rules.cjs');

async function withTriage(store, items) {
  return Promise.all(items.map(async ({ userId, triageId, ...item }) => {
    const triage = triageId ? await store.getTriage(triageId) : null;
    return { ...item, status: item.status || 'agendada', triage: triage && triage.userId === userId ? triage.data : null };
  }));
}

module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, ['GET', 'POST', 'PUT']);
  const user = await currentUser(req);
  const store = getStore();
  const audit = (action, targetId = null) => store.audit({ action, actorId: user.id, role: user.role, targetId, at: Date.now() });
  const input = req.body || {};

  if (req.method === 'POST' && input.action === 'activate') {
    await rateLimit(`panel-activate:${user.id}`, 10, 900000);
    if (typeof input.code !== 'string' || !safeEqual(input.code, rules.panelCode())) fail(403, 'Código de acesso incorreto.');
    const assignment = rules.staffAssignment(input);
    await store.setStaffRole(user.id, assignment);
    await audit('panel.activate', assignment.professionalId || assignment.clinicId);
    return res.status(200).json({ user: { ...user, ...assignment } });
  }

  rules.requireStaff(user);

  if (req.method === 'GET') {
    const date = new URL(req.url, 'http://localhost').searchParams.get('date') || rules.today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(422, 'Data inválida.');
    const scope = user.role === 'recepcao' ? { clinicId: user.clinicId } : { professionalId: user.professionalId };
    const items = (await store.listAgenda(scope, date)).sort((a, b) => a.time.localeCompare(b.time));
    await audit('panel.agenda', date);
    return res.status(200).json({ date, appointments: await withTriage(store, items) });
  }

  if (req.method === 'POST' && input.action === 'lookup') {
    if (user.role !== 'recepcao') fail(403, 'Busca por CPF disponível para a recepção.');
    await rateLimit(`panel-lookup:${user.id}`, 60, 3600000);
    const { cpfHash } = rules.protectCpf(input.cpf);
    const patient = await store.userByCpf(cpfHash);
    if (!patient) fail(404, 'Nenhum paciente com este CPF.');
    const from = rules.today();
    const items = (await store.listAppointments(patient.id)).filter(item => item.clinicId === user.clinicId && item.date >= from).map(item => ({ ...item, userId: patient.id }));
    await audit('panel.lookup', patient.id);
    return res.status(200).json({ patient: { name: patient.name, cpfMasked: patient.cpfMasked }, appointments: await withTriage(store, items) });
  }

  if (req.method === 'PUT') {
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.id)) fail(422, 'Consulta inválida.');
    const appointment = await store.getAppointment(input.id);
    if (!appointment) fail(404, 'Consulta não encontrada.');
    rules.checkTransition(user, appointment, input.status);
    await store.updateStatus(input.id, appointment.status || 'agendada', input.status);
    await audit(`status.${input.status}`, input.id);
    return res.status(200).json({ id: input.id, status: input.status });
  }
  fail(422, 'Ação inválida.');
});
