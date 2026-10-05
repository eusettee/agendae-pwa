const { getApps, initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { fail } = require('./http.cjs');
function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && (
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    (!process.env.VERCEL && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIRESTORE_EMULATOR_HOST))
  ));
}
function firestore() {
  if (!firebaseConfigured()) fail(503, 'Configure o Cloud Firestore para ativar as contas. A demonstração offline continua disponível.');
  if (process.env.VERCEL && process.env.FIRESTORE_EMULATOR_HOST) fail(503, 'O emulador Firebase não pode ser usado em produção.');
  let app = getApps().find(item => item.name === 'agendae');
  if (!app) {
    const options = { projectId: process.env.FIREBASE_PROJECT_ID };
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      options.credential = cert({ projectId: options.projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') });
    } else if (!process.env.FIRESTORE_EMULATOR_HOST) options.credential = applicationDefault();
    app = initializeApp(options, 'agendae');
  }
  return getFirestore(app);
}
module.exports = { firestore, firebaseConfigured };
