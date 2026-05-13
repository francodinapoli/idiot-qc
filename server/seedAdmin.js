'use strict';
const bcrypt = require('bcryptjs');
const { getPool } = require('./db');

const BCRYPT_ROUNDS = 10;

async function seedAdminIfEmpty() {
  const pool = getPool();
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM qc_users');
  const n = rows[0] && rows[0].n != null ? Number(rows[0].n) : 0;
  if (n > 0) {
    return;
  }
  const username = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!password || !String(password).length) {
    console.warn(
      '[seed] No hay usuarios en qc_users y falta DEFAULT_ADMIN_PASSWORD. ' +
        'Definila en .env y reiniciá, o creá un usuario manualmente en la base.'
    );
    return;
  }
  const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  await pool.query('INSERT INTO qc_users (username, password_hash) VALUES (?, ?)', [username, hash]);
  console.log('[seed] Usuario inicial creado:', username);
}

module.exports = { seedAdminIfEmpty };
