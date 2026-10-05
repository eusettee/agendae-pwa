function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function endpoint(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
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
module.exports = { fail, endpoint, requireMethod };
