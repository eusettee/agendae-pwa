// Servidor local: Express com a API em camadas e os arquivos públicos da PWA.
const http = require('node:http');
const { createApp } = require('./lib/app.cjs');
const server = http.createServer(createApp());
if (require.main === module) server.listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('Agendaê: http://localhost:' + (process.env.PORT || 3000)));
module.exports = server;
