'use strict';
const mysql = require('mysql2/promise');

let pool = null;

function getConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'idiot_qc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getConfig());
  }
  return pool;
}

async function waitForConnection(maxAttempts, delayMs) {
  const attempts = maxAttempts || 30;
  const delay = delayMs || 2000;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const p = getPool();
      const conn = await p.getConnection();
      conn.release();
      return true;
    } catch (e) {
      lastErr = e;
      console.warn('[mysql] intento ' + (i + 1) + '/' + attempts + ': ' + (e.message || e));
      await new Promise(function (resolve) {
        setTimeout(resolve, delay);
      });
    }
  }
  throw lastErr || new Error('MySQL no disponible');
}

async function initSchema() {
  const p = getPool();
  await p.query(
    'CREATE TABLE IF NOT EXISTS qc_settings (\n' +
      '  id INT PRIMARY KEY,\n' +
      '  weights JSON NOT NULL\n' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
  await p.query(
    "INSERT IGNORE INTO qc_settings (id, weights) VALUES (1, JSON_OBJECT('C', 10, 'M', 3, 'm', 1))"
  );
  await p.query(
    'CREATE TABLE IF NOT EXISTS qc_sessions (\n' +
      '  id VARCHAR(64) PRIMARY KEY,\n' +
      '  product_id VARCHAR(32) NOT NULL,\n' +
      '  sn VARCHAR(512) NOT NULL DEFAULT \'\',\n' +
      '  pin VARCHAR(512) NOT NULL DEFAULT \'\',\n' +
      '  armo VARCHAR(512) NOT NULL DEFAULT \'\',\n' +
      '  reviso VARCHAR(512) NOT NULL DEFAULT \'\',\n' +
      '  status VARCHAR(32) NOT NULL,\n' +
      '  fpy INT NOT NULL DEFAULT 0,\n' +
      '  checks JSON NOT NULL,\n' +
      '  embalo VARCHAR(512) NULL,\n' +
      '  created_at DATETIME(3) NOT NULL,\n' +
      '  finished_at DATETIME(3) NULL,\n' +
      '  saved_at DATETIME(3) NULL,\n' +
      '  INDEX idx_qc_sessions_created (created_at),\n' +
      '  INDEX idx_qc_sessions_product (product_id)\n' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
  await p.query(
    'CREATE TABLE IF NOT EXISTS qc_custom_products (\n' +
      '  product_id VARCHAR(32) PRIMARY KEY,\n' +
      '  definition JSON NOT NULL,\n' +
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\n' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
  await p.query(
    'CREATE TABLE IF NOT EXISTS qc_users (\n' +
      '  id INT AUTO_INCREMENT PRIMARY KEY,\n' +
      '  username VARCHAR(64) NOT NULL UNIQUE,\n' +
      '  password_hash VARCHAR(255) NOT NULL,\n' +
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n' +
      '  INDEX idx_qc_users_username (username)\n' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
}

module.exports = {
  getPool,
  waitForConnection,
  initSchema,
};
