const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SQLITE_PATH = ':memory:';
delete process.env.OPENAI_API_KEY;
const server = require('../server.cjs');
const { normalizeCpf } = require('../lib/rules.cjs');
const CPF = '529.982.247-25';
test('CPF: valida dígitos verificadores', () => {
  assert.equal(normalizeCpf(CPF), '52998224725');
  assert.equal(normalizeCpf('529.982.247-24'), null);
  assert.equal(normalizeCpf('111.111.111-11'), null);
});
test('fluxo completo: pré-triagem compartilhada, CPF, recepção e profissional', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/`;
  const call = async (path, method = 'GET', body, cookie) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const register = async (name, email) => (await call('auth', 'POST', { action: 'register', name, email, password: 'senha-teste-123', consent: true })).cookie;
  try {
    const patient = await register('Paciente Painel', 'paciente-painel@example.test');
    const reception = await register('Recepção Boa Vista', 'recepcao@example.test');
    const doctor = await register('Dra. Ana', 'ana@example.test');
    // Paciente: CPF, pré-triagem compartilhada e agendamento com a pré-triagem anexada.
    assert.equal((await call('auth', 'POST', { action: 'profile', cpf: CPF, consent: false }, patient)).status, 422);
    const profile = await call('auth', 'POST', { action: 'profile', cpf: CPF, consent: true }, patient);
    assert.equal(profile.data.user.cpfMasked, '***.982.***-25');
    assert.equal((await call('auth', 'POST', { action: 'profile', cpf: CPF, consent: true }, doctor)).status, 409);
    const triage = await call('triage', 'POST', { symptoms: 'Relato fictício de tosse e cansaço leve', duration: 'três dias', intensity: 'leve', consent: true, share: true }, patient);
    assert.match(triage.data.triageId, /^[0-9a-f-]{36}$/);
    const booking = { clinicId: 'boa-vista', professionalId: 'ana', date: '2099-10-05', time: '09:00' };
    assert.equal((await call('appointments', 'POST', { ...booking, triageId: triage.data.triageId }, doctor)).status, 422);
    const saved = await call('appointments', 'POST', { ...booking, triageId: triage.data.triageId }, patient);
    assert.equal(saved.status, 201);
    const id = saved.data.appointment.id;
    // Painel: paciente não acessa; código incorreto é recusado.
    assert.equal((await call('panel?date=2099-10-05', 'GET', null, patient)).status, 403);
    assert.equal((await call('panel', 'POST', { action: 'activate', role: 'recepcao', clinicId: 'boa-vista', code: 'errado' }, reception)).status, 403);
    assert.equal((await call('panel', 'POST', { action: 'activate', role: 'recepcao', clinicId: 'boa-vista', code: 'painel-demo' }, reception)).data.user.role, 'recepcao');
    assert.equal((await call('panel', 'POST', { action: 'activate', role: 'profissional', professionalId: 'ana', code: 'painel-demo' }, doctor)).status, 200);
    assert.equal((await call('panel', 'POST', { action: 'activate', role: 'profissional', professionalId: 'ana', code: 'painel-demo' }, patient)).status, 409);
    // Recepção localiza pelo CPF e vê a pré-triagem.
    const lookup = await call('panel', 'POST', { action: 'lookup', cpf: CPF }, reception);
    assert.equal(lookup.data.patient.name, 'Paciente Painel');
    assert.equal(lookup.data.appointments[0].triage.symptoms, 'Relato fictício de tosse e cansaço leve');
    assert.equal((await call('panel', 'POST', { action: 'lookup', cpf: CPF }, doctor)).status, 403);
    // Profissional vê a agenda; chegada só no dia; situação bloqueia edição do paciente.
    const agenda = await call('panel?date=2099-10-05', 'GET', null, doctor);
    assert.equal(agenda.data.appointments.length, 1);
    assert.equal(agenda.data.appointments[0].userId, undefined);
    assert.equal((await call('panel', 'PUT', { id, status: 'chegou' }, reception)).status, 409);
    assert.equal((await call('panel', 'PUT', { id, status: 'chegou' }, doctor)).status, 409);
    assert.equal((await call('panel', 'PUT', { id, status: 'realizada' }, doctor)).status, 200);
    assert.equal((await call('appointments', 'GET', null, patient)).data.appointments[0].status, 'realizada');
    assert.equal((await call('appointments', 'DELETE', { id }, patient)).status, 409);
    assert.equal((await call('status')).data.chat, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
