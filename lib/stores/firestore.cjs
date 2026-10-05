const { createHash } = require('node:crypto');
const { firestore } = require('../firebase.cjs');
const { fail } = require('../http.cjs');
const documentId = value => createHash('sha256').update(value).digest('hex');
const slotId = item => documentId(JSON.stringify([item.professionalId, item.date, item.time]));
function createFirestoreStore(db = firestore()) {
  const collection = name => db.collection(name);
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
      if (!user.exists) return null;
      const { id, name, email } = user.data(); return { id, name, email };
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
    async listAppointments(userId) {
      const snapshot = await collection('appointments').where('userId', '==', userId).get();
      return snapshot.docs.map(doc => {
        const { userId: owner, createdAt, ...item } = doc.data(); return item;
      }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
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
        const reservation = await tx.get(newSlot);
        if (reservation.exists && reservation.data().appointmentId !== item.id) fail(409, 'Este horário já está ocupado. Escolha outro.');
        // Todas as leituras ocorrem antes das escritas da transação.
        if (previous.exists && slotId(previous.data()) !== slotId(item)) tx.delete(collection('slots').doc(slotId(previous.data())));
        tx.set(ref, { ...item, userId, createdAt: previous.exists ? previous.data().createdAt : Date.now() });
        tx.set(newSlot, { professionalId: item.professionalId, date: item.date, time: item.time, appointmentId: item.id });
      });
    },
    async deleteAppointment(id, userId) {
      const ref = collection('appointments').doc(id);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists || snapshot.data().userId !== userId) fail(404, 'Consulta não encontrada.');
        tx.delete(collection('slots').doc(slotId(snapshot.data()))); tx.delete(ref);
      });
    }
  };
}
module.exports = { createFirestoreStore, slotId };
