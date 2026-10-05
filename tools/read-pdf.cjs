const fs = require('node:fs');
const zlib = require('node:zlib');
const bytes = fs.readFileSync(process.argv[2]);
const source = bytes.toString('latin1');
function ascii85(text) {
  let group = [], output = [];
  for (const char of text.replace(/\s/g, '').replace(/~>$/, '')) {
    if (char === 'z') { output.push(0, 0, 0, 0); continue; }
    group.push(char.charCodeAt(0) - 33);
    if (group.length === 5) {
      let value = group.reduce((a, b) => a * 85 + b, 0);
      output.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
      group = [];
    }
  }
  if (group.length) {
    const length = group.length;
    while (group.length < 5) group.push(84);
    let value = group.reduce((a, b) => a * 85 + b, 0);
    output.push(...[(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].slice(0, length - 1));
  }
  return Buffer.from(output);
}
const streams = /<<([^]*?)>>\s*stream\r?\n/g;
let match;
while ((match = streams.exec(source))) {
  const end = source.indexOf('endstream', streams.lastIndex);
  let data = bytes.subarray(streams.lastIndex, end);
  streams.lastIndex = end + 9;
  try {
    if (match[1].includes('ASCII85Decode')) data = ascii85(data.toString('latin1').trim());
    if (match[1].includes('FlateDecode')) data = zlib.inflateSync(data);
    const content = data.toString('latin1');
    if (!/\bBT\b/.test(content)) continue;
    const strings = [...content.matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(m => m[1].replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8))).replace(/\\([()\\])/g, '$1'));
    console.log(strings.join(' '));
  } catch {}
}
