const { firebaseConfigured } = require('./firebase.cjs');
const { fail } = require('./http.cjs');
let store;
function getStore() {
  if (store) return store;
  if (firebaseConfigured()) store = require('./stores/firestore.cjs').createFirestoreStore();
  else if (!process.env.VERCEL) store = require('./stores/sqlite.cjs');
  else fail(503, 'Configure o Cloud Firestore para ativar as contas. A demonstração offline continua disponível.');
  return store;
}
module.exports = { getStore };
