'use strict';
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || '';
}

function requireAuth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ error: 'Servidor sin JWT_SECRET configurado' });
  }
  const raw = req.headers.authorization || '';
  const m = raw.match(/^Bearer\s+(\S+)/i);
  if (!m) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const payload = jwt.verify(m[1], secret);
    req.user = {
      id: payload.sub,
      username: payload.username,
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = {
  requireAuth,
  getJwtSecret,
};
