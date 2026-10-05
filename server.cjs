const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const handlers = Object.fromEntries(['catalog', 'appointments', 'auth', 'mobile-auth', 'availability', 'triage', 'status'].map(name => [`/api/${name}`, require(`./api/${name}.js`)]));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
  const url = new URL(req.url, 'http://localhost');
  if (handlers[url.pathname]) {
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) return res.status(413).json({ error: 'Dados muito grandes.' });
      }
      req.body = body ? JSON.parse(body) : {};
      return handlers[url.pathname](req, res);
    } catch { return res.status(400).json({ error: 'JSON inválido.' }); }
  }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
  catch { res.statusCode = 400; return res.end(); }
  if (!file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.statusCode = 404; return res.end('Página não encontrada.'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname === '/sw.js') res.setHeader('Cache-Control', 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
if (require.main === module) server.listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('Agendaê: http://localhost:' + (process.env.PORT || 3000)));
module.exports = server;
