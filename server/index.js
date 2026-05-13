'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const fs = require('fs');
const { waitForConnection, initSchema } = require('./db');
const { loadBootstrap, replaceState } = require('./mysqlStore');
const { mergeProducts } = require('./mergeProducts');
const { seedAdminIfEmpty } = require('./seedAdmin');
const { postLogin, getMe, postLogout } = require('./authHandlers');
const { requireAuth, getJwtSecret } = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const defaultProductsPath = path.join(rootDir, 'data', 'defaultProducts.json');

if (!getJwtSecret()) {
  console.error('Falta JWT_SECRET en .env (cadena larga y aleatoria para firmar tokens).');
  process.exit(1);
}

app.use(express.json({ limit: '50mb' }));

function loadDefaultProducts() {
  const raw = fs.readFileSync(defaultProductsPath, 'utf8');
  return JSON.parse(raw);
}

app.post('/api/login', postLogin);
app.post('/api/logout', postLogout);
app.get('/api/me', requireAuth, getMe);

app.get('/api/bootstrap', requireAuth, async function (req, res) {
  try {
    const defaults = loadDefaultProducts();
    const data = await loadBootstrap(defaults, mergeProducts);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

app.put('/api/state', requireAuth, async function (req, res) {
  try {
    await replaceState(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

app.use(express.static(publicDir));

app.get('*', function (req, res) {
  if (req.path.indexOf('/api') === 0) {
    return res.status(404).json({ error: 'not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function main() {
  console.log('Conectando a MySQL…');
  await waitForConnection();
  await initSchema();
  await seedAdminIfEmpty();
  console.log('Esquema MySQL listo.');
  app.listen(PORT, function () {
    console.log('IDIOT QC en http://localhost:' + PORT);
  });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
