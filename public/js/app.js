let PRODUCTS = {};

const SEV_LABELS = { C: 'Crítico', M: 'Mayor', m: 'Menor' };

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
let state = {
  view: 'home',
  currentProduct: null,
  session: null,
  sessions: [],
  openSections: {},
  weights: { C: 10, M: 3, m: 1 },
  customProducts: {},
};

var _saveTimer = null;
var AUTH_TOKEN_KEY = 'idiot_qc_token';

function getStoredToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}
function setStoredToken(token) {
  try {
    if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    else sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {}
}
function authHeaders() {
  const t = getStoredToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showMainApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function saveState() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    fetch('/api/state', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({
        sessions: state.sessions,
        weights: state.weights,
        customProducts: state.customProducts || {},
      }),
    }).catch(function () {});
  }, 400);
}

async function bootstrapFromServer() {
  const r = await fetch('/api/bootstrap', { headers: authHeaders() });
  if (r.status === 401) {
    setStoredToken('');
    throw new Error('Sesión expirada o no autorizado');
  }
  if (!r.ok) throw new Error('API bootstrap: ' + r.status);
  const d = await r.json();
  PRODUCTS = d.products;
  state.sessions = d.sessions || [];
  if (d.weights) state.weights = d.weights;
  state.customProducts = d.customProducts || {};
}

async function submitLogin() {
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = '';
  const username = (document.getElementById('login-user') && document.getElementById('login-user').value || '').trim();
  const password = (document.getElementById('login-pass') && document.getElementById('login-pass').value) || '';
  if (!username || !password) {
    if (errEl) errEl.textContent = 'Completá usuario y contraseña';
    return;
  }
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) {
    if (errEl) errEl.textContent = data.error || 'Error al iniciar sesión';
    return;
  }
  setStoredToken(data.token);
  const passEl = document.getElementById('login-pass');
  if (passEl) passEl.value = '';
  await enterAppAfterAuth();
}

async function logoutSession() {
  try {
    await fetch('/api/logout', { method: 'POST', headers: authHeaders() });
  } catch (e) {}
  setStoredToken('');
  showLoginScreen();
}

async function enterAppAfterAuth() {
  showMainApp();
  try {
    await bootstrapFromServer();
    renderHome();
  } catch (e) {
    const el = document.getElementById('content');
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-title">Error al cargar</div><div class="empty-sub">${String(e.message || e)}</div></div>`;
    if (String(e.message || '').indexOf('Sesión') >= 0 || String(e.message || '').indexOf('401') >= 0) {
      showLoginScreen();
    }
  }
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function navigate(view, productId) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');
  closeSidebar();
  if (view === 'home') renderHome();
  else if (view === 'qc' && productId) startQC(productId);
  else if (view === 'dashboard') renderDashboard();
  else if (view === 'history') renderHistory();
  else if (view === 'config') renderConfig();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════
function renderHome() {
  document.getElementById('topbar-title').textContent = 'Seleccioná un producto';
  document.getElementById('topbar-meta').textContent = '';
  document.getElementById('topbar-actions').innerHTML = '';
  document.getElementById('active-session-nav').textContent = 'Ninguno';

  const pending = state.sessions.filter(s => s.status === 'pending');

  const c = document.getElementById('content');
  c.innerHTML = `
    ${pending.length ? `
    <div style="margin-bottom:20px">
      <div class="card-title" style="color:var(--amber);margin-bottom:10px">⏸ Pendientes de embalaje (${pending.length})</div>
      <div class="card" style="padding:0;border-color:#f59e0b40">
        ${pending.map(s => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px">
            <span style="font-size:18px">${PRODUCTS[s.productId]?.icon || '📦'}</span>
            <div style="flex:1">
              <div style="font-weight:500">${PRODUCTS[s.productId]?.name || s.productId}</div>
              <div style="font-size:11px;color:var(--text2);font-family:var(--mono)">S/N: ${s.sn || '—'} · ${calcFPY(s)}% FPY · guardado ${formatDate(s.savedAt||s.createdAt)}</div>
            </div>
            <button class="btn btn-ghost" style="font-size:12px;padding:5px 12px" onclick="resumeQC('${s.id}')">▶ Retomar</button>
            <button class="btn btn-accent" style="font-size:12px;padding:5px 12px" onclick="closePackaging('${s.id}')">📦 Embalar</button>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="card-title" style="margin-bottom:12px">¿Qué vas a inspeccionar hoy?</div>
    <div class="product-grid">
      ${Object.entries(PRODUCTS).map(([id, p]) => {
        const sessions = state.sessions.filter(s => s.productId === id && s.status !== 'pending');
        const passed = sessions.filter(s => s.status === 'pass').length;
        const pend = state.sessions.filter(s => s.productId === id && s.status === 'pending').length;
        return `
        <div class="product-card" onclick="navigate('qc','${id}')">
          <div class="product-icon">${p.icon}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.desc}</div>
          <div class="product-stats">
            <span class="stat-pill">${countChecks(id)} checks</span>
            ${sessions.length ? `<span class="stat-pill" style="color:var(--green)">${passed}/${sessions.length} OK</span>` : ''}
            ${pend ? `<span class="stat-pill" style="color:var(--amber)">${pend} pendiente${pend>1?'s':''}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${state.sessions.filter(s => s.status !== 'pending').length ? `
    <div class="card-title" style="margin-top:24px;margin-bottom:12px">Últimas inspecciones</div>
    <div class="card" style="padding:0">
      ${state.sessions.filter(s => s.status !== 'pending').slice(-5).reverse().map(s => sessionRow(s)).join('')}
    </div>` : ''}
  `;
}

function countChecks(productId) {
  return PRODUCTS[productId].sections.reduce((a, s) => a + s.items.length, 0);
}

function resumeQC(sessionId) {
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;
  startQC(sess.productId, sessionId);
}

function closePackaging(sessionId) {
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;
  const p = PRODUCTS[sess.productId];
  const failures = p ? p.sections.flatMap(s => s.items).filter(it => sess.checks[it.id]?.state === 'fail') : [];
  const critFailed = failures.filter(it => it.sev === 'C').length;
  const majorFailed = failures.filter(it => it.sev === 'M').length;

  showModal(`
    <div class="modal-title">📦 Confirmar embalaje</div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Marcás este equipo como <strong>finalizado y embalado</strong>.<br>
      <span style="font-family:var(--mono)">${PRODUCTS[sess.productId]?.name} · S/N: ${sess.sn}</span>
    </p>
    ${failures.length ? `
    <div style="padding:10px;background:var(--red-dim);border-radius:8px;margin-bottom:14px;font-size:12px;color:var(--red)">
      ⚠ Tiene ${critFailed} defecto${critFailed!==1?'s':''} crítico${critFailed!==1?'s':''} y ${majorFailed} mayor${majorFailed!==1?'es':''}
    </div>` : `
    <div style="padding:10px;background:var(--green-dim);border-radius:8px;margin-bottom:14px;font-size:12px;color:var(--green)">
      ✓ Sin defectos detectados
    </div>`}
    <div style="margin-bottom:14px">
      <div class="field-label">Embaló (nombre)</div>
      <input class="field-input" id="packager-input" placeholder="Nombre de quien embaló">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="confirmPackaging('${sessionId}')">Confirmar embalaje</button>
    </div>
  `);
}

function confirmPackaging(sessionId) {
  const packager = document.getElementById('packager-input')?.value.trim() || '';
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  const p = PRODUCTS[sess.productId];
  const failures = p ? p.sections.flatMap(s => s.items).filter(it => sess.checks[it.id]?.state === 'fail') : [];
  const critFailed = failures.filter(it => it.sev === 'C').length;
  const majorFailed = failures.filter(it => it.sev === 'M').length;

  sess.status = (critFailed > 0 || majorFailed > 3) ? 'fail' : 'pass';
  sess.embaló = packager;
  sess.finishedAt = new Date().toISOString();
  sess.fpy = calcFPY(sess);

  saveState();
  closeModal();
  showToast(`${sess.status === 'pass' ? '✓ Aprobado' : '✗ Rechazado'} y embalado`, sess.status === 'pass' ? 'success' : 'error');
  renderHome();
}

function sessionRow(s) {
  const fpy = calcFPY(s);
  const statusMap = {
    pass:    ['status-pass',   'APROBADO'],
    fail:    ['status-fail',   'RECHAZADO'],
    pending: ['status-wip',    'PEND. EMBALAJE'],
    wip:     ['status-wip',    'EN CURSO'],
  };
  const [cls, txt] = statusMap[s.status] || statusMap.wip;
  return `<div class="history-row" onclick="viewSession('${s.id}')">
    <span class="hist-product">${PRODUCTS[s.productId]?.name || s.productId}</span>
    <span class="hist-sn">${s.sn || '—'}</span>
    <span class="status-badge ${cls}">${txt}</span>
    <span class="hist-fpy" style="color:${fpy >= 95 ? 'var(--green)' : fpy >= 80 ? 'var(--amber)' : 'var(--red)'}">${fpy}%</span>
    <span class="hist-date">${formatDate(s.createdAt)}</span>
  </div>`;
}

// ═══════════════════════════════════════════
// QC SESSION
// ═══════════════════════════════════════════
function startQC(productId, resumeId = null) {
  const p = PRODUCTS[productId];
  state.currentProduct = productId;

  if (resumeId) {
    // Resume an existing pending session
    const existing = state.sessions.find(s => s.id === resumeId);
    if (existing) {
      state.session = JSON.parse(JSON.stringify(existing)); // deep clone
      // Remove from saved sessions while editing
      state.sessions = state.sessions.filter(s => s.id !== resumeId);
      saveState();
    }
  } else {
    state.session = {
      id: Date.now().toString(),
      productId,
      sn: '',
      pin: '',
      armo: '',
      reviso: '',
      createdAt: new Date().toISOString(),
      checks: {},
      status: 'wip',
    };
  }

  state.openSections = {};
  p.sections.forEach((s,i) => { if(i===0) state.openSections[s.id] = true; });
  renderQC();
}

function pauseQC() {
  // Save current session as 'pending' (pendiente embalaje)
  const sess = state.session;
  if (!sess.sn) { showToast('Ingresá el S/N antes de guardar', 'error'); return; }
  sess.status = 'pending';
  sess.savedAt = new Date().toISOString();
  sess.fpy = calcFPY(sess);
  state.sessions.push(sess);
  saveState();
  state.session = null;
  showToast('QC guardado — podés retomarlo desde el inicio', 'success');
  navigate('home');
}

function renderQC() {
  const productId = state.currentProduct;
  const p = PRODUCTS[productId];
  const sess = state.session;

  const total = countChecks(productId);
  const done = Object.values(sess.checks).filter(c => c.state !== null).length;
  const failed = Object.values(sess.checks).filter(c => c.state === 'fail').length;
  const critFailed = p.sections.flatMap(s => s.items)
    .filter(it => sess.checks[it.id]?.state === 'fail' && it.sev === 'C').length;
  const pct = total ? Math.round(done/total*100) : 0;

  document.getElementById('topbar-title').textContent = `QC — ${p.name}`;
  document.getElementById('topbar-meta').textContent = `${done}/${total} checks`;
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost" onclick="navigate('home')" style="margin-right:6px">← Volver</button>
    <button class="btn btn-ghost" onclick="pauseQC()" style="margin-right:6px" title="Guardar en estado Pendiente embalaje">⏸ Guardar</button>
    <button class="btn btn-accent" onclick="finishQC()">Finalizar QC</button>
  `;
  document.getElementById('active-session-nav').innerHTML = `
    <div style="color:var(--accent);font-size:12px;font-weight:500">${p.name}</div>
    <div style="color:var(--text3);font-size:11px;font-family:var(--mono)">${pct}% completado</div>
  `;

  const c = document.getElementById('content');
  c.innerHTML = `
    <!-- HEADER -->
    <div class="qc-header">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:22px">${p.icon}</span>
        <div>
          <div style="font-size:15px;font-weight:600">${p.name}</div>
          <div style="font-size:11px;color:var(--text2)">${p.desc}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          ${critFailed ? `<span style="color:var(--red);font-size:12px;font-weight:600">⚠ ${critFailed} crítico${critFailed>1?'s':''}</span>` : ''}
          ${failed && !critFailed ? `<span style="color:var(--amber);font-size:12px">${failed} falla${failed>1?'s':''}</span>` : ''}
        </div>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:var(--text2);font-family:var(--mono);margin-bottom:12px">${pct}% — ${done} de ${total} checks completados</div>
      
      <div class="qc-meta-grid">
        <div>
          <div class="field-label">S/N del equipo</div>
          <input class="field-input" id="field-sn" value="${sess.sn}" placeholder="Ej: OPS-2024-001" oninput="sess_field('sn',this.value)">
        </div>
        <div>
          <div class="field-label">PIN del dispositivo</div>
          <input class="field-input" id="field-pin" value="${sess.pin}" placeholder="——" oninput="sess_field('pin',this.value)">
        </div>
      </div>
      <div class="signer-row">
        <div>
          <div class="field-label">Armó</div>
          <input class="field-input" value="${sess.armo}" placeholder="Nombre de quien armó" oninput="sess_field('armo',this.value)">
        </div>
        <div>
          <div class="field-label">Revisó</div>
          <input class="field-input" value="${sess.reviso}" placeholder="Nombre de quien revisó" oninput="sess_field('reviso',this.value)">
        </div>
      </div>
    </div>

    <!-- SECTIONS -->
    ${p.sections.map(sec => renderSection(sec, sess)).join('')}

    <div style="height:20px"></div>
  `;
}

function renderSection(sec, sess) {
  const total = sec.items.length;
  const done = sec.items.filter(it => sess.checks[it.id]?.state !== undefined && sess.checks[it.id]?.state !== null).length;
  const failed = sec.items.filter(it => sess.checks[it.id]?.state === 'fail').length;
  const isOpen = state.openSections[sec.id];
  
  return `
    <div class="qc-section">
      <div class="section-header ${isOpen ? 'open' : ''}" onclick="toggleSection('${sec.id}')">
        <span class="section-name">${sec.name}</span>
        <span class="section-progress" style="color:${failed ? 'var(--red)' : done === total ? 'var(--green)' : 'var(--text2)'}">
          ${failed ? `${failed} falla${failed>1?'s':''} · ` : ''}${done}/${total}
        </span>
        <span class="section-chevron">▼</span>
      </div>
      <div class="section-body ${isOpen ? 'open' : ''}">
        ${sec.items.map(it => renderCheckItem(it, sess.checks[it.id])).join('')}
      </div>
    </div>`;
}

function renderCheckItem(item, check) {
  const st = check?.state || null;
  const note = check?.note || '';
  const defType = check?.defectType || '';
  const rowClass = st === 'ok' ? 'checked' : st === 'fail' ? 'failed' : '';

  return `
    <div class="check-item ${rowClass}" id="ci-${item.id}">
      <div class="check-content">
        <div class="check-label">
          ${item.text}
          <span class="check-severity sev-${item.sev}">${item.sev === 'C' ? '● Crítico' : item.sev === 'M' ? '◆ Mayor' : '○ Menor'}</span>
        </div>
        <div class="check-code">${item.id}</div>
        ${st === 'fail' ? `
          <div class="defect-note">
            <select class="defect-select" onchange="setCheckField('${item.id}','defectType',this.value)">
              <option value="">— Tipo de defecto —</option>
              <option value="dimensional" ${defType==='dimensional'?'selected':''}>Dimensional / ajuste</option>
              <option value="cosmetic" ${defType==='cosmetic'?'selected':''}>Cosmético / pintura</option>
              <option value="electrical" ${defType==='electrical'?'selected':''}>Eléctrico / conexión</option>
              <option value="functional" ${defType==='functional'?'selected':''}>Funcional / software</option>
              <option value="packing" ${defType==='packing'?'selected':''}>Packaging / faltante</option>
              <option value="other" ${defType==='other'?'selected':''}>Otro</option>
            </select>
            <input class="defect-input" style="margin-top:6px" placeholder="Descripción del defecto..." value="${note}" oninput="setCheckField('${item.id}','note',this.value)">
          </div>` : ''}
      </div>
      <div class="check-actions">
        <button class="mini-btn ${st==='ok'?'active-ok':''}" onclick="setCheck('${item.id}','ok')" title="OK">✓</button>
        <button class="mini-btn ${st==='fail'?'active-fail':''}" onclick="setCheck('${item.id}','fail')" title="Falla">✗</button>
      </div>
    </div>`;
}

function sess_field(field, val) {
  if (state.session) state.session[field] = val;
}

function toggleSection(secId) {
  state.openSections[secId] = !state.openSections[secId];
  renderQC();
}

function setCheck(itemId, val) {
  if (!state.session.checks[itemId]) state.session.checks[itemId] = { state: null, note: '', defectType: '' };
  // Toggle off if same
  if (state.session.checks[itemId].state === val) {
    state.session.checks[itemId].state = null;
  } else {
    state.session.checks[itemId].state = val;
    if (val === 'ok') { state.session.checks[itemId].note = ''; state.session.checks[itemId].defectType = ''; }
  }
  // Re-render just the check item row in place
  const p = PRODUCTS[state.currentProduct];
  let item = null;
  for (const sec of p.sections) {
    item = sec.items.find(it => it.id === itemId);
    if (item) break;
  }
  if (item) {
    const el = document.getElementById(`ci-${itemId}`);
    if (el) el.outerHTML = renderCheckItem(item, state.session.checks[itemId]);
  }
  // Update progress in topbar
  const total = countChecks(state.currentProduct);
  const done = Object.values(state.session.checks).filter(c => c.state !== null).length;
  document.getElementById('topbar-meta').textContent = `${done}/${total} checks`;
  // Update progress bar
  const pct = total ? Math.round(done/total*100) : 0;
  const pb = document.querySelector('.progress-bar');
  if (pb) pb.style.width = pct + '%';
  const ptext = document.querySelector('.progress-bar-wrap + div');
  if (ptext) ptext.textContent = `${pct}% — ${done} de ${total} checks completados`;
}

function setCheckField(itemId, field, val) {
  if (!state.session.checks[itemId]) state.session.checks[itemId] = { state: null, note: '', defectType: '' };
  state.session.checks[itemId][field] = val;
}

function finishQC() {
  const sess = state.session;
  const p = PRODUCTS[state.currentProduct];
  if (!sess.sn) { showToast('Ingresá el número de serie antes de finalizar', 'error'); return; }
  if (!sess.armo) { showToast('Completá el campo "Armó"', 'error'); return; }

  const total = countChecks(state.currentProduct);
  const done = Object.values(sess.checks).filter(c => c.state !== null).length;
  const failures = p.sections.flatMap(s => s.items).filter(it => sess.checks[it.id]?.state === 'fail');
  const critFailed = failures.filter(it => it.sev === 'C').length;
  const pct = total ? Math.round(done/total*100) : 0;

  if (pct < 100) {
    showModal(`
      <div class="modal-title">Quedan checks sin completar</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Completaste ${done} de ${total} checks (${pct}%). ¿Querés finalizar igual o seguir revisando?</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Seguir revisando</button>
        <button class="btn btn-accent" onclick="confirmFinish()">Finalizar igual</button>
      </div>
    `);
    return;
  }
  confirmFinish();
}

function confirmFinish() {
  closeModal();
  const sess = state.session;
  const p = PRODUCTS[state.currentProduct];
  const failures = p.sections.flatMap(s => s.items).filter(it => sess.checks[it.id]?.state === 'fail');
  const critFailed = failures.filter(it => it.sev === 'C').length;
  const majorFailed = failures.filter(it => it.sev === 'M').length;

  // Determine status
  if (critFailed > 0) sess.status = 'fail';
  else if (majorFailed > 3) sess.status = 'fail';
  else sess.status = 'pass';

  sess.finishedAt = new Date().toISOString();
  sess.fpy = calcFPY(sess);

  state.sessions.push(sess);
  saveState();
  state.session = null;

  showResultModal(sess, failures);
}

function showResultModal(sess, failures) {
  const pass = sess.status === 'pass';
  const fpy = sess.fpy;
  showModal(`
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:40px;margin-bottom:8px">${pass ? '✅' : '❌'}</div>
      <div style="font-size:20px;font-weight:600;color:${pass ? 'var(--green)' : 'var(--red)'};margin-bottom:4px">
        ${pass ? 'APROBADO' : 'RECHAZADO'}
      </div>
      <div style="font-size:13px;color:var(--text2)">S/N: ${sess.sn} · FPY: ${fpy}%</div>
    </div>
    ${failures.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">DEFECTOS ENCONTRADOS (${failures.length})</div>
      ${failures.map(it => `
        <div style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:var(--bg3);border-radius:7px;margin-bottom:6px;font-size:12px">
          <span class="check-severity sev-${it.sev}">${it.sev}</span>
          <span>${it.text}</span>
        </div>`).join('')}
    ` : '<div style="color:var(--green);font-size:13px;text-align:center">Sin defectos detectados 🎉</div>'}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal();navigate('home')">Volver al inicio</button>
      <button class="btn btn-accent" onclick="closeModal();navigate('dashboard')">Ver dashboard</button>
    </div>
  `);
}

function viewSession(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  const p = PRODUCTS[s.productId];
  const failures = p ? p.sections.flatMap(sec => sec.items).filter(it => s.checks[it.id]?.state === 'fail') : [];
  const fpy = calcFPY(s);
  showModal(`
    <div class="modal-title">${p?.name || s.productId} — ${s.sn}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px">
      <div><span style="color:var(--text3)">Armó:</span> ${s.armo || '—'}</div>
      <div><span style="color:var(--text3)">Revisó:</span> ${s.reviso || '—'}</div>
      <div><span style="color:var(--text3)">Fecha:</span> ${formatDate(s.createdAt)}</div>
      <div><span style="color:var(--text3)">FPY:</span> <span style="color:${fpy>=95?'var(--green)':fpy>=80?'var(--amber)':'var(--red)'}">${fpy}%</span></div>
    </div>
    ${failures.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Defectos (${failures.length})</div>
      ${failures.map(it => `
        <div style="padding:8px;background:var(--bg3);border-radius:7px;margin-bottom:6px;font-size:12px">
          <div style="display:flex;gap:6px;align-items:center">
            <span class="check-severity sev-${it.sev}">${it.sev}</span>
            <span style="font-weight:500">${it.text}</span>
          </div>
          ${s.checks[it.id]?.note ? `<div style="color:var(--text2);margin-top:4px">${s.checks[it.id].note}</div>` : ''}
        </div>`).join('')}
    ` : '<div style="color:var(--green);font-size:13px">Sin defectos ✓</div>'}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
    </div>
  `);
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  document.getElementById('topbar-title').textContent = 'Dashboard';
  document.getElementById('topbar-meta').textContent = '';
  document.getElementById('topbar-actions').innerHTML = '';

  const sessions = state.sessions;
  const total = sessions.length;
  const passed = sessions.filter(s => s.status === 'pass').length;
  const failed = sessions.filter(s => s.status === 'fail').length;
  const wip = sessions.filter(s => s.status === 'wip').length;
  const avgFPY = total ? Math.round(sessions.reduce((a,s) => a + calcFPY(s), 0) / total) : 0;

  // Defect breakdown
  const allDefects = [];
  sessions.forEach(s => {
    const p = PRODUCTS[s.productId];
    if (!p) return;
    p.sections.flatMap(sec => sec.items).forEach(it => {
      if (s.checks[it.id]?.state === 'fail') {
        allDefects.push({ ...it, defectType: s.checks[it.id].defectType, product: s.productId });
      }
    });
  });
  const critCount = allDefects.filter(d => d.sev === 'C').length;
  const majorCount = allDefects.filter(d => d.sev === 'M').length;
  const minorCount = allDefects.filter(d => d.sev === 'm').length;

  // Top defects
  const defectFreq = {};
  allDefects.forEach(d => { defectFreq[d.text] = (defectFreq[d.text] || 0) + 1; });
  const topDefects = Object.entries(defectFreq).sort((a,b) => b[1]-a[1]).slice(0,5);

  // FPY by product
  const fypByProduct = {};
  Object.keys(PRODUCTS).forEach(id => {
    const ps = sessions.filter(s => s.productId === id && s.status !== 'wip');
    if (ps.length) fypByProduct[id] = Math.round(ps.reduce((a,s) => a + calcFPY(s), 0) / ps.length);
  });

  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="dash-grid">
      <div class="metric-card">
        <div class="metric-label">Total QC</div>
        <div class="metric-value metric-accent">${total}</div>
        <div class="metric-sub">inspecciones</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">FPY promedio</div>
        <div class="metric-value ${avgFPY>=95?'metric-green':avgFPY>=80?'metric-amber':'metric-red'}">${total ? avgFPY+'%' : '—'}</div>
        <div class="metric-sub">First Pass Yield</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Aprobados</div>
        <div class="metric-value metric-green">${passed}</div>
        <div class="metric-sub">${total ? Math.round(passed/total*100) : 0}% del total</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Rechazados</div>
        <div class="metric-value metric-red">${failed}</div>
        <div class="metric-sub">${total ? Math.round(failed/total*100) : 0}% del total</div>
      </div>
    </div>

    ${allDefects.length ? `
    <div class="card">
      <div class="card-title">Defectos por severidad</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px">
          <span class="check-severity sev-C">C</span>
          <span>${critCount} críticos</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px">
          <span class="check-severity sev-M">M</span>
          <span>${majorCount} mayores</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px">
          <span class="check-severity sev-m">m</span>
          <span>${minorCount} menores</span>
        </div>
      </div>
      ${topDefects.length ? `
      <div class="card-title" style="margin-top:16px">Top defectos (Pareto)</div>
      ${topDefects.map(([txt, cnt]) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px">
          <div style="flex:1;color:var(--text2)">${txt}</div>
          <div class="progress-bar-wrap" style="width:80px"><div class="progress-bar" style="width:${Math.round(cnt/topDefects[0][1]*100)}%;background:var(--red)"></div></div>
          <div style="color:var(--red);font-family:var(--mono);min-width:20px;text-align:right">${cnt}</div>
        </div>`).join('')}
      ` : ''}
    </div>
    ` : ''}

    ${Object.keys(fypByProduct).length ? `
    <div class="card">
      <div class="card-title">FPY por producto</div>
      ${Object.entries(fypByProduct).map(([id, fpy]) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px">
          <span style="min-width:80px;font-weight:500">${PRODUCTS[id].name}</span>
          <div class="progress-bar-wrap" style="flex:1"><div class="progress-bar" style="width:${fpy}%;background:${fpy>=95?'var(--green)':fpy>=80?'var(--amber)':'var(--red)'}"></div></div>
          <span style="font-family:var(--mono);font-size:12px;min-width:42px;text-align:right;color:${fpy>=95?'var(--green)':fpy>=80?'var(--amber)':'var(--red)'}">${fpy}%</span>
        </div>`).join('')}
    </div>` : ''}

    ${!total ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sin datos todavía</div><div class="empty-sub">Completá tu primer QC para ver estadísticas aquí</div></div>` : ''}
  `;
}

// ═══════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════
function renderHistory() {
  document.getElementById('topbar-title').textContent = 'Historial de inspecciones';
  document.getElementById('topbar-meta').textContent = `${state.sessions.length} registros`;
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost" onclick="exportCSV()" style="margin-right:6px">Exportar CSV</button>
  `;

  const c = document.getElementById('content');
  if (!state.sessions.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin historial</div><div class="empty-sub">Los QC finalizados aparecerán aquí</div></div>`;
    return;
  }
  c.innerHTML = `
    <div class="card" style="padding:0">
      <div style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text3);font-family:var(--mono)">
        <span style="min-width:80px">PRODUCTO</span>
        <span style="flex:1">S/N</span>
        <span style="min-width:80px">ESTADO</span>
        <span style="min-width:50px;text-align:right">FPY</span>
        <span style="min-width:90px;text-align:right">FECHA</span>
        <span style="min-width:32px"></span>
      </div>
      ${[...state.sessions].reverse().map(s => sessionRowWithDelete(s)).join('')}
    </div>
  `;
}

function sessionRowWithDelete(s) {
  const fpy = calcFPY(s);
  const status = s.status === 'pass' ? 'status-pass' : s.status === 'fail' ? 'status-fail' : 'status-wip';
  const statusTxt = s.status === 'pass' ? 'APROBADO' : s.status === 'fail' ? 'RECHAZADO' : 'EN CURSO';
  return `<div class="history-row" style="cursor:default">
    <span class="hist-product" style="cursor:pointer;text-decoration:underline;text-decoration-color:var(--border2)" onclick="viewSession('${s.id}')">${PRODUCTS[s.productId]?.name || s.productId}</span>
    <span class="hist-sn">${s.sn || '—'}</span>
    <span class="status-badge ${status}">${statusTxt}</span>
    <span class="hist-fpy" style="color:${fpy >= 95 ? 'var(--green)' : fpy >= 80 ? 'var(--amber)' : 'var(--red)'}">${fpy}%</span>
    <span class="hist-date">${formatDate(s.createdAt)}</span>
    <button onclick="confirmDeleteSession('${s.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;padding:2px 4px;border-radius:4px;transition:color .15s" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">✕</button>
  </div>`;
}

function confirmDeleteSession(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  showModal(`
    <div class="modal-title">¿Borrar este QC?</div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Vas a eliminar el QC de <strong>${PRODUCTS[s.productId]?.name || s.productId}</strong> · S/N <strong>${s.sn || '—'}</strong> del ${formatDate(s.createdAt)}.<br><br>Esta acción no se puede deshacer.
    </p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="deleteSession('${id}')">Borrar definitivamente</button>
    </div>
  `);
}

function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  saveState();
  closeModal();
  showToast('QC eliminado', 'error');
  renderHistory();
}

// ═══════════════════════════════════════════
// CONFIGURACIÓN — Ponderación y edición de checks
// ═══════════════════════════════════════════
function renderConfig() {
  document.getElementById('topbar-title').textContent = 'Configuración';
  document.getElementById('topbar-meta').textContent = '';
  document.getElementById('topbar-actions').innerHTML = '';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector('[data-view="config"]');
  if (navEl) navEl.classList.add('active');

  const w = state.weights;
  const c = document.getElementById('content');
  c.innerHTML = `
    <!-- PONDERACIÓN -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Ponderación de criticidad para FPY</div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:16px">
        El FPY ponderado descuenta más puntos por defectos críticos que por menores.<br>
        <span style="font-family:var(--mono);font-size:11px">FPY = 1 − (Σ peso×fallas) / (Σ peso×total)</span>
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${[['C','Crítico','var(--red)'],['M','Mayor','var(--amber)'],['m','Menor','var(--blue)']].map(([k,label,color])=>`
        <div>
          <div class="field-label" style="color:${color}">${label} (${k})</div>
          <input type="number" min="1" max="100" class="field-input" id="w-${k}" value="${w[k]}"
            oninput="state.weights['${k}']=parseInt(this.value)||1;saveState()">
        </div>`).join('')}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:7px;font-size:12px;color:var(--text2)">
        Ejemplo: con pesos C=<span id="ex-C">${w.C}</span> / M=<span id="ex-M">${w.M}</span> / m=<span id="ex-m">${w.m}</span> →
        1 defecto Crítico pesa lo mismo que <span id="ex-ratio">${(w.C/w.m).toFixed(1)}</span> defectos Menores.
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="state.weights={C:10,M:3,m:1};saveState();renderConfig();showToast('Pesos restaurados','')">Restaurar defaults</button>
        <button class="btn btn-accent" onclick="saveState();showToast('Ponderación guardada','success')">Guardar</button>
      </div>
    </div>

    <!-- EDITOR DE CHECKS -->
    <div class="card">
      <div class="card-title">Editar líneas de QC por producto</div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:14px">Seleccioná un producto para ver y modificar sus checks.</p>
      <select class="field-input" id="edit-product-sel" onchange="renderCheckEditor(this.value)" style="margin-bottom:16px">
        <option value="">— Elegí un producto —</option>
        ${Object.entries(PRODUCTS).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')}
      </select>
      <div id="check-editor"></div>
    </div>

    <!-- ALMACENAMIENTO Y SESIÓN -->
    <div class="card" style="margin-top:16px">
      <div class="card-title">Cuenta y datos</div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:12px">Los datos de QC se guardan en MySQL en el servidor.</p>
      <button type="button" class="btn btn-ghost" onclick="logoutSession()">Cerrar sesión</button>
    </div>
  `;
}

function renderCheckEditor(productId) {
  const container = document.getElementById('check-editor');
  if (!productId) { container.innerHTML = ''; return; }
  const p = PRODUCTS[productId];

  container.innerHTML = p.sections.map((sec, si) => `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;display:flex;align-items:center;gap:8px">
        ${sec.name}
        <button class="btn btn-ghost" style="padding:3px 10px;font-size:11px" onclick="addCheckItem('${productId}',${si})">+ Agregar línea</button>
      </div>
      ${sec.items.map((it, ii) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px" id="edit-row-${it.id}">
          <select style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:11px;color:var(--text);font-family:var(--font);outline:none;min-width:80px"
            onchange="editCheckField('${productId}',${si},${ii},'sev',this.value)">
            <option value="C" ${it.sev==='C'?'selected':''}>● Crítico</option>
            <option value="M" ${it.sev==='M'?'selected':''}>◆ Mayor</option>
            <option value="m" ${it.sev==='m'?'selected':''}>○ Menor</option>
          </select>
          <input class="field-input" style="flex:1;padding:6px 10px;font-size:12px" value="${it.text.replace(/"/g,'&quot;')}"
            onchange="editCheckField('${productId}',${si},${ii},'text',this.value)">
          <button onclick="deleteCheckItem('${productId}',${si},${ii})"
            style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;padding:2px 6px;border-radius:4px;transition:color .15s"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">✕</button>
        </div>`).join('')}
    </div>
  `).join('') + `
    <button class="btn btn-accent" style="margin-top:8px" onclick="saveProductEdits('${productId}')">Guardar cambios en ${p.name}</button>
  `;
}

function editCheckField(productId, si, ii, field, val) {
  PRODUCTS[productId].sections[si].items[ii][field] = val;
}

function deleteCheckItem(productId, si, ii) {
  PRODUCTS[productId].sections[si].items.splice(ii, 1);
  saveProductEdits(productId, true);
  renderCheckEditor(productId);
}

function addCheckItem(productId, si) {
  const sec = PRODUCTS[productId].sections[si];
  const newId = sec.id + '-' + Date.now();
  sec.items.push({ id: newId, text: 'Nuevo check...', sev: 'M' });
  saveProductEdits(productId, true);
  renderCheckEditor(productId);
}

function saveProductEdits(productId, silent = false) {
  if (!state.customProducts) state.customProducts = {};
  state.customProducts[productId] = JSON.parse(JSON.stringify(PRODUCTS[productId]));
  saveState();
  if (!silent) showToast('Checks actualizados', 'success');
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function calcFPY(sess) {
  const p = PRODUCTS[sess.productId];
  if (!p) return 0;
  const w = state.weights;
  let totalWeight = 0, failWeight = 0;
  p.sections.flatMap(s => s.items).forEach(it => {
    const wt = w[it.sev] || 1;
    totalWeight += wt;
    if (sess.checks[it.id]?.state === 'fail') failWeight += wt;
  });
  if (!totalWeight) return 100;
  return Math.round((1 - failWeight / totalWeight) * 100);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}

function exportCSV() {
  const rows = [['ID','Producto','SN','Armo','Reviso','Estado','FPY_ponderado','Fecha','Defectos_C','Defectos_M','Defectos_m']];
  state.sessions.forEach(s => {
    const p = PRODUCTS[s.productId];
    const failures = p ? p.sections.flatMap(sec => sec.items).filter(it => s.checks[it.id]?.state === 'fail') : [];
    rows.push([
      s.id, PRODUCTS[s.productId]?.name || s.productId, s.sn, s.armo, s.reviso,
      s.status, calcFPY(s) + '%', formatDate(s.createdAt),
      failures.filter(f => f.sev === 'C').length,
      failures.filter(f => f.sev === 'M').length,
      failures.filter(f => f.sev === 'm').length,
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `idiot_qc_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('CSV exportado correctamente', 'success');
}

// ═══════════════════════════════════════════
// MODAL & TOAST
// ═══════════════════════════════════════════
function showModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
}
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.className = 'toast', 3000);
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function startApp() {
  const token = getStoredToken();
  if (!token) {
    showLoginScreen();
    return;
  }
  const me = await fetch('/api/me', { headers: authHeaders() });
  if (!me.ok) {
    setStoredToken('');
    showLoginScreen();
    return;
  }
  await enterAppAfterAuth();
}
startApp();
