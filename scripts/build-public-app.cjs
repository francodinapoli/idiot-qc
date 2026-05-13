'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const outPath = path.join(root, 'public', 'js', 'app.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const SEV_LABELS');
const end = html.indexOf('</script>', start);
if (start < 0 || end < 0) {
  console.error('No se encontró el bloque de script (const SEV_LABELS … </script>)');
  process.exit(1);
}
let s = html.slice(start, end);
if (!s.startsWith('let PRODUCTS')) {
  s = 'let PRODUCTS = {};\n\n' + s;
}
fs.writeFileSync(outPath, s, 'utf8');
console.log('Generado', outPath, '(' + s.length + ' chars)');
