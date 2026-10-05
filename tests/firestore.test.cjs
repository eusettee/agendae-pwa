const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreStore } = require('../lib/stores/firestore.cjs');
const { firebaseConfigured } = require('../lib/firebase.cjs');

// Simula o contrato do SDK: leitura antes de escrita e commits atômicos.
// Não substitui um teste no emulador ou em um projeto Firebase real.
function fakeFirestore() {
  const documents = new Map(); let queue = Promise.resolve();
  const snapshot = ref => ({ exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) });
  const reference = path => ({ path, get: async () => snapshot({ path }), set: async value => documents.set(path, structuredClone(value)), delete: async () => documents.delete(path) });
  const collection = (name, filters = []) => ({
    doc: id => reference(`${name}/${id}`),
    where: (field, operator, value) => { assert.equal(operator, '=='); return collection(name, [...filters, [field, value]]); },
    get: async () => ({ docs: [...documents.entries()].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([field, value]) => data[field] === value)).map(([path]) => snapshot({ path })) })
  });
  return {
    collection,
    runTransaction(callback) {
      const job = queue.then(async () => {
        const writes = []; let writing = false;
        const tx = {
          get: async ref => { assert.equal(writing, false, 'Leituras precisam preceder as escritas'); return snapshot(ref); },
          create: (ref, value) => { writing = true; assert.equal(documents.has(ref.path), false); writes.push(() => documents.set(ref.path, structuredClone(value))); },
          set: (ref, value) => { writing = true; writes.push(() => documents.set(ref.path, structuredClone(value))); },
          delete: ref => { writing = true; writes.push(() => documents.delete(ref.path)); }
        };
        const result = await callback(tx); writes.forEach(commit => commit()); return result;
      });
      queue = job.catch(() => {}); return job;
    }
  };
}
const appointment = { id: 'appointment-1', patient: 'Demo', clinicId: 'boa-vista', professionalId: 'ana', date: '2099-10-05', time: '09:00' };
test('Firestore: reserva concorrente aceita uma consulta e rejeita a outra', async () => {
  const store = createFirestoreStore(fakeFirestore());
  const results = await Promise.allSettled([store.saveAppointment(appointment, 'user-1', true), store.saveAppointment({ ...appointment, id: 'appointment-2' }, 'user-2', true)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.deepEqual(await store.occupied('ana', appointment.date), ['09:00']);
});
test('Firestore: edição mantém reserva anterior em conflito e libera ao reagendar/cancelar', async () => {
  const store = createFirestoreStore(fakeFirestore());
  await store.saveAppointment(appointment, 'user-1', true);
  await store.saveAppointment({ ...appointment, id: 'appointment-2', time: '10:00' }, 'user-2', true);
  await assert.rejects(() => store.saveAppointment({ ...appointment, time: '10:00' }, 'user-1', false), error => error.status === 409);
  assert.deepEqual((await store.occupied('ana', appointment.date)).sort(), ['09:00', '10:00']);
  await store.saveAppointment({ ...appointment, time: '11:00' }, 'user-1', false);
  assert.deepEqual((await store.occupied('ana', appointment.date)).sort(), ['10:00', '11:00']);
  await store.deleteAppointment(appointment.id, 'user-1');
  assert.deepEqual(await store.occupied('ana', appointment.date), ['10:00']);
});
test('Firestore: isola leitura, edição e exclusão entre usuários', async () => {
  const store = createFirestoreStore(fakeFirestore());
  await store.saveAppointment(appointment, 'user-1', true);
  assert.deepEqual(await store.listAppointments('user-2'), []);
  await assert.rejects(() => store.saveAppointment(appointment, 'user-2', false), error => error.status === 404);
  await assert.rejects(() => store.deleteAppointment(appointment.id, 'user-2'), error => error.status === 404);
  assert.deepEqual(await store.listAppointments('user-1'), [appointment]);
});
test('Firestore: e-mail único, sessão expira e limite é incrementado em transação', async () => {
  const store = createFirestoreStore(fakeFirestore());
  const user = { id: 'user-1', name: 'Demo', email: 'demo@example.test', passwordHash: 'test-hash', createdAt: 1 };
  await store.createUser(user);
  await assert.rejects(() => store.createUser({ ...user, id: 'user-2' }), error => error.status === 409);
  assert.deepEqual(await store.userByEmail(user.email), user);
  await store.createSession('token-hash', user.id, 100);
  assert.deepEqual(await store.sessionUser('token-hash', 99), { id: user.id, name: user.name, email: user.email });
  assert.equal(await store.sessionUser('token-hash', 100), null);
  assert.deepEqual(await Promise.all([1,2,3].map(() => store.incrementLimit('key', 1000))), [1,2,3]);
});
test('Firebase não considera só o ID do projeto como credencial de produção', () => {
  const keys = ['VERCEL','FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','GOOGLE_APPLICATION_CREDENTIALS','FIRESTORE_EMULATOR_HOST'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    keys.forEach(key => delete process.env[key]); process.env.VERCEL = '1'; process.env.FIREBASE_PROJECT_ID = 'demo-agendae';
    assert.equal(firebaseConfigured(), false);
    process.env.FIREBASE_CLIENT_EMAIL = 'server@example.test'; process.env.FIREBASE_PRIVATE_KEY = 'test-only';
    assert.equal(firebaseConfigured(), true);
  } finally { keys.forEach(key => previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]); }
});
