function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
// cors: libera outra origem (ex.: app Expo na web) em rotas sem cookie nem login.
function endpoint(handler, { cors = false } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    }
    try {
      if (!cors && !['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        if (origin && new URL(origin).host !== host) fail(403, 'Origem não permitida.');
        if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Origem não permitida.');
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Envie os dados em JSON.');
      }
      await handler(req, res);
    } catch (error) {
      return res.status(error.status || 503).json({ error: error.status ? error.message : 'Serviço indisponível. Tente novamente em instantes.' });
    }
  };
}
function requireMethod(req, res, methods) {
  res.setHeader('Allow', methods.join(', '));
  if (!methods.includes(req.method)) fail(405, 'Método não permitido.');
}
async function readRawBody(req, limit = 65536) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > limit) fail(413, 'Dados muito grandes.'); }
  return body;
}
module.exports = { fail, endpoint, requireMethod, readRawBody };
