'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');
const { getJwtSecret } = require('./authMiddleware');

function getExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '8h';
}

async function postLogin(req, res) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ error: 'Servidor sin JWT_SECRET configurado' });
  }
  const username = (req.body && req.body.username ? String(req.body.username) : '').trim();
  const password = req.body && req.body.password != null ? String(req.body.password) : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM qc_users WHERE username = ? LIMIT 1',
      [username]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign(
      { sub: row.id, username: row.username },
      secret,
      { expiresIn: getExpiresIn() }
    );
    res.json({
      token: token,
      user: { username: row.username },
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}

function getMe(req, res) {
  res.json({ user: { username: req.user.username } });
}

function postLogout(req, res) {
  res.status(204).end();
}

module.exports = {
  postLogin,
  getMe,
  postLogout,
};
