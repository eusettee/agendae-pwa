// API Node.js/Express: monta as mesmas rotas usadas como funções serverless na Vercel.
const path = require('node:path');
const express = require('express');
const ROUTES = ['catalog', 'appointments', 'auth', 'mobile-auth', 'availability', 'triage', 'status', 'panel', 'chat', 'gateway', 'whatsapp'];
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const json = express.json({ limit: '8kb', type: () => true, verify: (req, res, buffer) => { req.rawBody = buffer.toString('utf8'); } });
  for (const name of ROUTES) {
    const handler = require(`../api/${name}.js`);
    // /api/v1/* é a versão estável do contrato; /api/* continua para compatibilidade.
    app.all([`/api/${name}`, `/api/v1/${name}`], json, (req, res, next) => { req.body ??= {}; Promise.resolve(handler(req, res)).catch(next); });
  }
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    setHeaders: (res, file) => { res.setHeader('X-Content-Type-Options', 'nosniff'); if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); }
  }));
  app.use((req, res) => res.status(404).type('text/plain').send('Página não encontrada.'));
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Dados muito grandes.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    return res.status(500).json({ error: 'Erro interno.' });
  });
  return app;
}
module.exports = { createApp };
