const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAppointment } = require('../lib/appointment.cjs');
const server = require('../server.cjs');
const valid = { patient: 'Paciente Demo', clinicId: 'boa-vista', professionalId: 'ana', date: '2099-10-05', time: '09:00' };
test('validação rejeita passado, fim de semana, datas inválidas e vínculo incorreto', () => {
  assert.equal(validateAppointment(valid, 0), null);
  assert.match(validateAppointment({ ...valid, date: '2020-10-05' }), /futuro/);
  assert.match(validateAppointment({ ...valid, date: '2099-10-03' }, 0), /segunda/);
  assert.match(validateAppointment({ ...valid, date: '2099-02-30' }, 0), /válida/);
  assert.match(validateAppointment({ ...valid, professionalId: 'julia' }, 0), /profissional/);
  assert.match(validateAppointment({ ...valid, patient: ' ' }), /nome/);
});
test('API responde ao catálogo, valida consulta e rejeita entradas inválidas', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/catalog`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).clinics.length, 3);
    const post = data => fetch(`${base}/api/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const success = await post(valid);
    assert.equal(success.status, 200); assert.equal((await success.json()).validated, true);
    assert.equal((await post({})).status, 422);
    assert.equal((await fetch(`${base}/api/appointments`)).status, 405);
    assert.equal((await fetch(`${base}/api/appointments`, { method: 'POST', body: 'invalid' })).status, 400);
    const manifest = await (await fetch(`${base}/manifest.json`)).json();
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) assert.equal((await fetch(base + icon.src)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
