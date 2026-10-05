const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { firestore } = require('../../lib/firebase.cjs');
const { createFirestoreStore } = require('../../lib/stores/firestore.cjs');
async function check() {
  const db = firestore(); const store = createFirestoreStore(db);
  const run = randomUUID(); const userId = `check-${run}`;
  const item = { id: run, patient: 'Verificação Firebase', clinicId: 'boa-vista', professionalId: `check-${run}`, date: '2099-10-05', time: '09:00' };
  const second = { ...item, id: randomUUID() };
  try {
    const result = await Promise.allSettled([store.saveAppointment(item,userId,true),store.saveAppointment(second,userId,true)]);
    assert.equal(result.filter(r => r.status === 'fulfilled').length,1);
    assert.equal(result.find(r => r.status === 'rejected').reason.status,409);
    const saved = (await store.listAppointments(userId))[0];
    await assert.rejects(() => store.deleteAppointment(saved.id,'other-user'),e=>e.status===404);
    await store.saveAppointment({ ...saved,time:'10:00' },userId,false);
    assert.deepEqual(await store.occupied(item.professionalId,item.date),['10:00']);
    await store.deleteAppointment(saved.id,userId);
    assert.deepEqual(await store.listAppointments(userId),[]);
    console.log('Firestore real: conexão, concorrência, edição, isolamento e exclusão confirmados.');
  } finally {
    for(const candidate of [item,second]) {
      try { await store.deleteAppointment(candidate.id,userId); } catch(error) { if(error.status!==404) console.error('Não foi possível limpar um registro de teste.'); }
    }
    await db.terminate();
  }
}
check().catch(error => { console.error(error.status ? error.message : 'Verificação Firebase falhou. Confira credenciais, Firestore e permissões.'); process.exitCode=1; });
