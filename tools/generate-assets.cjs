const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const catalog = require('../lib/catalog.cjs');
const root = path.join(__dirname, '..', 'public');
fs.mkdirSync(path.join(root, 'icons'), { recursive: true });
fs.mkdirSync(path.join(root, 'js'), { recursive: true });
fs.writeFileSync(path.join(root, 'js/catalog.js'), `window.AGENDAE_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function icon(size, filename) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const cross = (nx > .43 && nx < .57 && ny > .26 && ny < .74) || (ny > .43 && ny < .57 && nx > .26 && nx < .74);
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set(cross ? [222, 245, 170, 255] : [18, 92, 76, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  fs.writeFileSync(path.join(root, 'icons', filename), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
}
icon(192, 'icon-192.png'); icon(512, 'icon-512.png'); icon(512, 'icon-maskable-512.png');
console.log('Catálogo offline e ícones gerados.');
