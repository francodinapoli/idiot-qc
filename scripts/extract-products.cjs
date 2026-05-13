'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const outPath = path.join(root, 'data', 'defaultProducts.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const re = /let PRODUCTS = (\{[\s\S]*?\n\});\s*\nconst SEV_LABELS/;
const m = html.match(re);
if (!m) {
  console.error('No se encontró let PRODUCTS … const SEV_LABELS en index.html');
  process.exit(1);
}
const expr = '(' + m[1] + '\n)';
const PRODUCTS = vm.runInNewContext(expr, Object.create(null));
fs.writeFileSync(outPath, JSON.stringify(PRODUCTS, null, 2), 'utf8');
console.log('Escrito:', outPath, 'keys:', Object.keys(PRODUCTS).join(', '));
