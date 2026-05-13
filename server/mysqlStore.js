'use strict';
const { getPool } = require('./db');

function rowToSession(r) {
  const emb = r.embalo || '';
  return {
    id: r.id,
    productId: r.product_id,
    sn: r.sn || '',
    pin: r.pin || '',
    armo: r.armo || '',
    reviso: r.reviso || '',
    status: r.status,
    fpy: r.fpy != null ? r.fpy : 0,
    checks: typeof r.checks === 'string' ? JSON.parse(r.checks) : r.checks || {},
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : undefined,
    savedAt: r.saved_at ? new Date(r.saved_at).toISOString() : undefined,
    embaló: emb || undefined,
  };
}

async function loadBootstrap(defaultProducts, mergeProducts) {
  const pool = getPool();
  const [sessionRows] = await pool.query(
    'SELECT * FROM qc_sessions ORDER BY created_at DESC'
  );
  const sessions = sessionRows.map(rowToSession);

  const [wRows] = await pool.query('SELECT weights FROM qc_settings WHERE id = 1 LIMIT 1');
  let weights = { C: 10, M: 3, m: 1 };
  if (wRows.length && wRows[0].weights) {
    const w = wRows[0].weights;
    weights = typeof w === 'string' ? JSON.parse(w) : w;
  }

  const [cRows] = await pool.query('SELECT product_id, definition FROM qc_custom_products');
  const customProducts = {};
  cRows.forEach(function (row) {
    const def = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition;
    customProducts[row.product_id] = def;
  });

  const products = mergeProducts(defaultProducts, customProducts);

  return {
    products: products,
    sessions: sessions,
    weights: weights,
    customProducts: customProducts,
  };
}

async function replaceState(body) {
  const sessions = Array.isArray(body.sessions) ? body.sessions : [];
  const weights =
    body.weights && typeof body.weights === 'object' ? body.weights : { C: 10, M: 3, m: 1 };
  const customProducts =
    body.customProducts && typeof body.customProducts === 'object' ? body.customProducts : {};

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM qc_sessions');

    for (let si = 0; si < sessions.length; si++) {
      const sess = sessions[si];
      const checks = sess.checks || {};
      const embalo =
        sess.embalo != null && sess.embalo !== ''
          ? sess.embalo
          : sess.embaló != null && sess.embaló !== ''
            ? sess.embaló
            : null;
      await conn.query(
        'INSERT INTO qc_sessions (id, product_id, sn, pin, armo, reviso, status, fpy, checks, embalo, created_at, finished_at, saved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          String(sess.id),
          String(sess.productId || ''),
          String(sess.sn || ''),
          String(sess.pin || ''),
          String(sess.armo || ''),
          String(sess.reviso || ''),
          String(sess.status || 'wip'),
          parseInt(sess.fpy, 10) || 0,
          JSON.stringify(checks),
          embalo,
          sess.createdAt ? new Date(sess.createdAt) : new Date(),
          sess.finishedAt ? new Date(sess.finishedAt) : null,
          sess.savedAt ? new Date(sess.savedAt) : null,
        ]
      );
    }

    await conn.query('UPDATE qc_settings SET weights = ? WHERE id = 1', [JSON.stringify(weights)]);

    await conn.query('DELETE FROM qc_custom_products');
    const ids = Object.keys(customProducts);
    for (let i = 0; i < ids.length; i++) {
      const pid = ids[i];
      await conn.query('INSERT INTO qc_custom_products (product_id, definition) VALUES (?, ?)', [
        pid,
        JSON.stringify(customProducts[pid]),
      ]);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  loadBootstrap,
  replaceState,
};
