const { createHash, randomUUID } = require('node:crypto');
const { firestore } = require('../firebase.cjs');
const { fail } = require('../http.cjs');
const documentId = value => createHash('sha256').update(value).digest('hex');
const slotId = item => documentId(JSON.stringify([item.professionalId, item.date, item.time]));
const publicUser = data => ({ id: data.id, name: data.name, email: data.email, role: data.role || 'paciente', clinicId: data.clinicId || null, professionalId: data.professionalId || null, cpfMasked: data.cpfMasked || null });
function createFirestoreStore(db = firestore()) {
  const collection = name => db.collection(name);
  const appointmentOut = data => { const { userId, createdAt, ...item } = data; return { ...item, status: item.status || 'agendada' }; };
  return {
    async createUser(user) {
      const email = collection('uniqueEmails').doc(documentId(user.email));
      await db.runTransaction(async tx => {
        if ((await tx.get(email)).exists) fail(409, 'Não foi possível criar a conta com este e-mail. Tente entrar.');
        tx.create(collection('users').doc(user.id), user);
        tx.create(email, { userId: user.id });
      });
    },
    async userByEmail(email) {
      const index = await collection('uniqueEmails').doc(documentId(email)).get();
      if (!index.exists) return null;
      const user = await collection('users').doc(index.data().userId).get();
      return user.exists ? user.data() : null;
    },
    async sessionUser(tokenHash, now) {
      const ref = collection('sessions').doc(tokenHash);
      const session = await ref.get();
      if (!session.exists) return null;
      if (session.data().expiresAt <= now) { await ref.delete(); return null; }
      const user = await collection('users').doc(session.data().userId).get();
      return user.exists ? publicUser(user.data()) : null;
    },
    async createSession(tokenHash, userId, expiresAt) {
      await collection('sessions').doc(tokenHash).set({ userId, expiresAt, deleteAfter: new Date(expiresAt) });
    },
    async deleteSession(tokenHash) { await collection('sessions').doc(tokenHash).delete(); },
    async incrementLimit(key, expiresAt) {
      const ref = collection('requestLimits').doc(documentId(key));
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const count = snapshot.exists ? snapshot.data().count + 1 : 1;
        tx.set(ref, { count, expiresAt, deleteAfter: new Date(expiresAt) }); return count;
      });
    },
    async setStaffRole(userId, { role, clinicId, professionalId }) {
      const userRef = collection('users').doc(userId);
      await db.runTransaction(async tx => {
        const user = await tx.get(userRef);
        const lock = professionalId ? collection('professionalAccounts').doc(professionalId) : null;
        const owner = lock ? await tx.get(lock) : null;
        if (!user.exists) fail(404, 'Conta não encontrada.');
        if (owner?.exists && owner.data().userId !== userId) fail(409, 'Este profissional já possui uma conta ativa no painel.');
        const previous = user.data().professionalId;
        if (previous && previous !== professionalId) tx.delete(collection('professionalAccounts').doc(previous));
        if (lock) tx.set(lock, { userId });
        tx.set(userRef, { ...user.data(), role, clinicId, professionalId });
      });
    },
    async setCpf(userId, cpfHash, cpfMasked) {
      const userRef = collection('users').doc(userId);
      await db.runTransaction(async tx => {
        const user = await tx.get(userRef);
        const index = cpfHash ? collection('uniqueCpfs').doc(cpfHash) : null;
        const owner = index ? await tx.get(index) : null;
        if (!user.exists) fail(404, 'Conta não encontrada.');
        if (owner?.exists && owner.data().userId !== userId) fail(409, 'Este CPF já está vinculado a outra conta.');
        const previous = user.data().cpfHash;
        if (previous && previous !== cpfHash) tx.delete(collection('uniqueCpfs').doc(previous));
        if (index) tx.set(index, { userId });
        tx.set(userRef, { ...user.data(), cpfHash: cpfHash || null, cpfMasked: cpfMasked || null });
      });
    },
    async userByCpf(cpfHash) {
      const index = await collection('uniqueCpfs').doc(cpfHash).get();
      if (!index.exists) return null;
      const user = await collection('users').doc(index.data().userId).get();
      return user.exists ? { id: user.data().id, name: user.data().name, cpfMasked: user.data().cpfMasked } : null;
    },
    async listAppointments(userId) {
      const snapshot = await collection('appointments').where('userId', '==', userId).get();
      return snapshot.docs.map(doc => appointmentOut(doc.data())).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    },
    // Dois filtros de igualdade usam os índices automáticos do Firestore.
    async listAgenda(scope, date) {
      const [field, value] = scope.professionalId ? ['professionalId', scope.professionalId] : ['clinicId', scope.clinicId];
      const snapshot = await collection('appointments').where(field, '==', value).where('date', '==', date).get();
      return snapshot.docs.map(doc => ({ ...appointmentOut(doc.data()), userId: doc.data().userId }));
    },
    async getAppointment(id) {
      const doc = await collection('appointments').doc(id).get();
      return doc.exists ? { ...appointmentOut(doc.data()), userId: doc.data().userId } : null;
    },
    async updateStatus(id, from, to) {
      const ref = collection('appointments').doc(id);
      await db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) fail(404, 'Consulta não encontrada.');
        if ((doc.data().status || 'agendada') !== from) fail(409, 'A consulta foi alterada. Atualize o painel.');
        tx.set(ref, { ...doc.data(), status: to, statusAt: Date.now() });
      });
    },
    async occupied(professionalId, date) {
      const snapshot = await collection('slots').where('professionalId', '==', professionalId).where('date', '==', date).get();
      return snapshot.docs.map(doc => doc.data().time);
    },
    async saveAppointment(item, userId, creating) {
      const ref = collection('appointments').doc(item.id);
      const newSlot = collection('slots').doc(slotId(item));
      await db.runTransaction(async tx => {
        const previous = await tx.get(ref);
        if (!creating && (!previous.exists || previous.data().userId !== userId)) fail(404, 'Consulta não encontrada.');
        if (creating && previous.exists) fail(409, 'Consulta já cadastrada.');
        if (previous.exists && (previous.data().status || 'agendada') !== 'agendada') fail(409, 'Esta consulta já foi registrada pela unidade e não pode ser alterada.');
        const reservation = await tx.get(newSlot);
        if (reservation.exists && reservation.data().appointmentId !== item.id) fail(409, 'Este horário já está ocupado. Escolha outro.');
        // Todas as leituras ocorrem antes das escritas da transação.
        if (previous.exists && slotId(previous.data()) !== slotId(item)) tx.delete(collection('slots').doc(slotId(previous.data())));
        const triageId = item.triageId || (previous.exists ? previous.data().triageId : undefined);
        const record = { ...item, status: 'agendada', userId, createdAt: previous.exists ? previous.data().createdAt : Date.now() };
        if (triageId) record.triageId = triageId; else delete record.triageId;
        tx.set(ref, record);
        tx.set(newSlot, { professionalId: item.professionalId, date: item.date, time: item.time, appointmentId: item.id });
      });
    },
    async deleteAppointment(id, userId) {
      const ref = collection('appointments').doc(id);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists || snapshot.data().userId !== userId) fail(404, 'Consulta não encontrada.');
        if ((snapshot.data().status || 'agendada') !== 'agendada') fail(409, 'Esta consulta já foi registrada pela unidade e não pode ser alterada.');
        tx.delete(collection('slots').doc(slotId(snapshot.data()))); tx.delete(ref);
      });
    },
    async saveTriage(triage) {
      await collection('triages').doc(triage.id).set({ ...triage, deleteAfter: new Date(triage.expiresAt) });
    },
    async getTriage(id) {
      const doc = await collection('triages').doc(id).get();
      if (!doc.exists || doc.data().expiresAt <= Date.now()) return null;
      return { userId: doc.data().userId, data: doc.data().data };
    },
    // Estado da conversa do WhatsApp (passo atual e escolhas), expira em 30 minutos.
    async getConversation(key) {
      const doc = await collection('conversations').doc(key).get();
      return doc.exists && doc.data().expiresAt > Date.now() ? JSON.parse(doc.data().state) : null;
    },
    async saveConversation(key, state, expiresAt) {
      await collection('conversations').doc(key).set({ state: JSON.stringify(state), expiresAt, deleteAfter: new Date(expiresAt) });
    },
    // Auditoria sem dados sensíveis: ação, autor, perfil, alvo e horário.
    async audit(entry) { await collection('auditLog').doc(randomUUID()).set({ ...entry, deleteAfter: new Date(entry.at + 365 * 86400000) }); }
  };
}
module.exports = { createFirestoreStore, slotId };
