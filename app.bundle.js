/* ============================================================
   AforoYa — app.bundle.js
   Pure JS, no frameworks, Firebase Compat SDK v9
   ============================================================ */

// ── Firebase config ─────────────────────────────────────────
// Replace with your Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyD1WjUHAR5v1EK8WPlvC_DpqnMj77tgYzU",
  authDomain: "aforoya-f2e04.firebaseapp.com",
  databaseURL: "https://aforoya-f2e04-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "aforoya-f2e04",
  storageBucket: "aforoya-f2e04.firebasestorage.app",
  messagingSenderId: "952335530782",
  appId: "1:952335530782:web:12b2f72e91d468b580670f"
};

// ── Firebase init ────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ── Utils ────────────────────────────────────────────────────
function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatTime(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3000);
}

function showModal(title, msg, onConfirm, confirmText = 'Confirmar') {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3 class="modal-title">${title}</h3>
      <p class="modal-msg">${msg}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
        <button class="btn btn-danger" id="modal-confirm">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('modal-show'));
  document.getElementById('modal-cancel').onclick = () => overlay.remove();
  document.getElementById('modal-confirm').onclick = () => { overlay.remove(); onConfirm(); };
}

function exportCSV(rows, filename) {
  if (!rows.length) { showToast('No hay datos para exportar', 'warn'); return; }
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Charts (native Canvas 2D) ────────────────────────────────
function drawLineChart(canvas, hourlyData, options = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth * window.devicePixelRatio;
  const H = canvas.offsetHeight * window.devicePixelRatio;
  canvas.width = W;
  canvas.height = H;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  const pad = { top: 20, right: 20, bottom: 36, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxY = Math.max(...Object.values(hourlyData), options.maxCapacity || 10, 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = pad.top + chartH * (1 - frac);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.font = `${10 * window.devicePixelRatio / window.devicePixelRatio}px system-ui`;
    ctx.fillText(Math.round(maxY * frac), 2, y + 4);
  });

  // X labels
  ctx.fillStyle = '#666';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  [0, 4, 8, 12, 16, 20, 23].forEach(h2 => {
    const x = pad.left + (h2 / 23) * chartW;
    ctx.fillText(`${String(h2).padStart(2, '0')}h`, x, h - 6);
  });

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0, 'rgba(0,255,136,0.3)');
  grad.addColorStop(1, 'rgba(0,255,136,0.01)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  hours.forEach((hr, i) => {
    const val = hourlyData[hr] || 0;
    const x = pad.left + (i / 23) * chartW;
    const y = pad.top + chartH * (1 - val / maxY);
    if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  hours.forEach((hr, i) => {
    const val = hourlyData[hr] || 0;
    const x = pad.left + (i / 23) * chartW;
    const y = pad.top + chartH * (1 - val / maxY);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBarChart(canvas, dayData, options = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth * window.devicePixelRatio;
  const H = canvas.offsetHeight * window.devicePixelRatio;
  canvas.width = W;
  canvas.height = H;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const values = days.map((_, i) => dayData[i] || 0);
  const maxY = Math.max(...values, 1);
  const pad = { top: 20, right: 10, bottom: 36, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const barW = (chartW / days.length) * 0.6;
  const gap = chartW / days.length;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0.5, 1].forEach(frac => {
    const y = pad.top + chartH * (1 - frac);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxY * frac), pad.left - 4, y + 4);
  });

  days.forEach((day, i) => {
    const x = pad.left + i * gap + (gap - barW) / 2;
    const barH = (values[i] / maxY) * chartH;
    const y = pad.top + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#4488ff');
    grad.addColorStop(1, 'rgba(68,136,255,0.3)');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = barH > 10 ? 10 : 0;

    const r = Math.min(6, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#888';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(day, x + barW / 2, h - 8);
  });
}

// ── Router ───────────────────────────────────────────────────
function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    local: p.get('local'),
    tipo: p.get('tipo'),
    view: p.get('view'),
    cupon: p.get('cupon')
  };
}

function mount(html) {
  document.getElementById('app').innerHTML = html;
}

async function router() {
  const { local, tipo, view, cupon } = getParams();

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (local && tipo === 'entrada') return viewClienteEntrada(local);
  if (local && tipo === 'salida') return viewClienteSalida(local);
  if (local && view === 'portero') return viewPorteroPIN(local);
  if (local && view === 'dueno') return viewDuenoAuth(local);
  if (cupon) return viewCupon(cupon);
  return viewHome();
}

// ── HOME ─────────────────────────────────────────────────────
function viewHome() {
  mount(`
    <div class="home-wrap">
      <div class="home-logo">
        <span class="logo-icon">🏛️</span>
        <h1 class="logo-title">AforoYa</h1>
        <p class="logo-sub">Control de aforo en tiempo real</p>
      </div>
      <div class="home-cards">
        <div class="home-card card-verde" onclick="location.href='?view=dueno&local=demo'">
          <span class="hc-icon">🏠</span>
          <span class="hc-label">Soy el Dueño</span>
        </div>
        <div class="home-card card-azul" onclick="location.href='?view=portero&local=demo'">
          <span class="hc-icon">🚪</span>
          <span class="hc-label">Soy Portero</span>
        </div>
      </div>
      <p class="home-hint">¿Cliente? Escanea el QR de la entrada del local</p>
    </div>
  `);
}

// ── CLIENTE — ENTRADA ────────────────────────────────────────
async function viewClienteEntrada(localId) {
  mount(`<div class="loading-screen"><div class="spinner verde"></div><p>Registrando entrada…</p></div>`);

  let local;
  try {
    const snap = await db.ref(`locales/${localId}`).once('value');
    local = snap.val();
    if (!local) throw new Error('Local no encontrado');
  } catch (e) {
    mount(`<div class="error-screen"><span>⚠️</span><p>${e.message}</p></div>`);
    return;
  }

  // Token anónimo
  let token = localStorage.getItem(`aforoya_token_${localId}`);
  if (!token) {
    token = generateToken();
    localStorage.setItem(`aforoya_token_${localId}`, token);
  }

  // Registrar entrada
  const today = todayStr();
  const entradaRef = db.ref(`locales/${localId}/sesionActual/entradas/${token}`);
  const prevSnap = await entradaRef.once('value');
  const prev = prevSnap.val();

  // Solo registrar si no hay entrada activa (sin salida)
  if (!prev || prev.salida !== null) {
    await entradaRef.set({ entrada: Date.now(), salida: null, fecha: today });
    // Incrementar aforo
    await db.ref(`locales/${localId}/aforoActual`).transaction(val => Math.min((val || 0) + 1, local.aforoMaximo));
  }

  const pct = Math.round(((local.aforoActual + 1) / local.aforoMaximo) * 100);

  mount(`
    <div class="cliente-screen entrada-screen">
      <div class="cliente-icon">✅</div>
      <h1 class="cliente-title">¡Bienvenido!</h1>
      <h2 class="cliente-venue">${local.nombre || 'Bar'}</h2>
      <div class="aforo-badge verde">
        <span class="aforo-num">${Math.min(local.aforoActual + 1, local.aforoMaximo)}</span>
        <span class="aforo-sep">/</span>
        <span class="aforo-max">${local.aforoMaximo}</span>
        <span class="aforo-label">personas dentro</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${pct}%;background:var(--verde)"></div>
      </div>
      <p class="cliente-hint">Escanea el <strong>QR de salida</strong><br>al marcharte y llévate tu sorpresa 🎁</p>
    </div>
  `);
}

// ── CLIENTE — SALIDA ─────────────────────────────────────────
async function viewClienteSalida(localId) {
  mount(`<div class="loading-screen"><div class="spinner rojo"></div><p>Registrando salida…</p></div>`);

  let local;
  try {
    const snap = await db.ref(`locales/${localId}`).once('value');
    local = snap.val();
    if (!local) throw new Error('Local no encontrado');
  } catch (e) {
    mount(`<div class="error-screen"><span>⚠️</span><p>${e.message}</p></div>`);
    return;
  }

  const token = localStorage.getItem(`aforoya_token_${localId}`);

  if (!token) {
    mount(`
      <div class="cliente-screen salida-screen">
        <div class="cliente-icon">👋</div>
        <h1 class="cliente-title">¡Hasta pronto!</h1>
        <h2 class="cliente-venue">${local.nombre || 'Bar'}</h2>
        <p class="cliente-hint">No se detectó entrada previa en este dispositivo.</p>
      </div>
    `);
    return;
  }

  const entradaRef = db.ref(`locales/${localId}/sesionActual/entradas/${token}`);
  const snap = await entradaRef.once('value');
  const entry = snap.val();

  if (entry && entry.salida === null) {
    const now = Date.now();
    await entradaRef.update({ salida: now });
    await db.ref(`locales/${localId}/aforoActual`).transaction(val => Math.max((val || 0) - 1, 0));
  }

  // Incentivo
  const incentivo = local.incentivo || 'descuento';
  let incentivoHTML = '';

  if (incentivo === 'descuento' || incentivo === 'ambos') {
    // Generar cupón
    const cuponToken = `cup_${token.slice(0, 8)}`;
    await db.ref(`locales/${localId}/sesionActual/cupones/${cuponToken}`).set({
      descuento: local.descuentoPorcentaje || 10,
      usado: false,
      creadoEn: Date.now()
    });
    const cuponURL = `${location.origin}${location.pathname}?cupon=${cuponToken}&local=${localId}`;
    incentivoHTML += `
      <div class="incentivo-card">
        <p class="incentivo-title">🎟️ Tu cupón descuento</p>
        <p class="incentivo-desc"><strong>${local.descuentoPorcentaje || 10}% OFF</strong> en tu próxima visita</p>
        <div id="qr-cupon" class="qr-holder"></div>
        <p class="incentivo-hint">Muéstralo en la entrada</p>
      </div>`;
  }

  if (incentivo === 'sorteo' || incentivo === 'ambos') {
    // Número de participación
    const sorteoRef = db.ref(`locales/${localId}/sesionActual/sorteo/participaciones/${token}`);
    const sSnap = await sorteoRef.once('value');
    let numero = sSnap.val() ? sSnap.val().numero : null;
    if (!numero) {
      const countSnap = await db.ref(`locales/${localId}/sesionActual/sorteo/participaciones`).once('value');
      numero = (countSnap.numChildren() || 0) + 1;
      await sorteoRef.set({ numero, ts: Date.now() });
    }
    incentivoHTML += `
      <div class="incentivo-card sorteo-card">
        <p class="incentivo-title">🎰 Sorteo mensual</p>
        <p class="incentivo-desc">¡Participas con el número</p>
        <div class="sorteo-numero">${numero}</div>
        <p class="incentivo-hint">El ganador se anuncia a fin de mes</p>
      </div>`;
  }

  mount(`
    <div class="cliente-screen salida-screen">
      <div class="cliente-icon">👋</div>
      <h1 class="cliente-title">¡Hasta pronto!</h1>
      <h2 class="cliente-venue">${local.nombre || 'Bar'}</h2>
      ${incentivoHTML}
    </div>
  `);

  // Generar QR del cupón si aplica
  const qrHolder = document.getElementById('qr-cupon');
  if (qrHolder && (incentivo === 'descuento' || incentivo === 'ambos')) {
    const cuponToken = `cup_${token.slice(0, 8)}`;
    const cuponURL = `${location.origin}${location.pathname}?cupon=${cuponToken}&local=${localId}`;
    new QRCode(qrHolder, { text: cuponURL, width: 160, height: 160, colorDark: '#00ff88', colorLight: '#141414' });
  }
}

// ── CUPÓN ────────────────────────────────────────────────────
async function viewCupon(cuponToken) {
  const params = getParams();
  const localId = params.local;
  if (!localId) {
    mount(`<div class="error-screen"><span>⚠️</span><p>Cupón inválido</p></div>`);
    return;
  }
  const snap = await db.ref(`locales/${localId}/sesionActual/cupones/${cuponToken}`).once('value');
  const cupon = snap.val();
  if (!cupon) {
    mount(`<div class="error-screen"><span>❌</span><p>Cupón no encontrado</p></div>`);
    return;
  }
  mount(`
    <div class="cliente-screen">
      <div class="cupon-card ${cupon.usado ? 'cupon-usado' : ''}">
        <p class="cupon-badge">${cupon.usado ? 'USADO' : 'VÁLIDO'}</p>
        <div class="cupon-icon">🎟️</div>
        <h2 class="cupon-title">${cupon.descuento}% Descuento</h2>
        <p class="cupon-sub">${cupon.usado ? 'Este cupón ya fue canjeado' : 'Muéstralo al portero para validarlo'}</p>
        <p class="cupon-code">${cuponToken}</p>
      </div>
    </div>
  `);
}

// ── PORTERO — PIN ────────────────────────────────────────────
function viewPorteroPIN(localId) {
  // Check session
  const stored = sessionStorage.getItem(`aforoya_portero_${localId}`);
  if (stored === 'ok') { viewPorteroOps(localId); return; }

  let input = '';
  let intentos = 0;
  let bloqueadoHasta = null;

  mount(`
    <div class="pin-screen">
      <div class="pin-logo">🚪</div>
      <h2 class="pin-title">Acceso Portero</h2>
      <div class="pin-display" id="pin-display">_ _ _ _</div>
      <p class="pin-error" id="pin-error"></p>
      <div class="numpad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
          <button class="numpad-btn ${k==='' ? 'invisible' : ''}" data-key="${k}">${k}</button>
        `).join('')}
      </div>
    </div>
  `);

  function renderDisplay() {
    const dots = Array.from({ length: 4 }, (_, i) => input[i] ? '●' : '○').join(' ');
    document.getElementById('pin-display').textContent = dots;
  }

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      if (!key || btn.classList.contains('invisible')) return;

      if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
        const secs = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
        document.getElementById('pin-error').textContent = `Bloqueado ${secs}s…`;
        return;
      }

      if (key === '⌫') { input = input.slice(0, -1); renderDisplay(); return; }
      if (input.length >= 4) return;
      input += key;
      renderDisplay();

      if (input.length === 4) {
        try {
          const snap = await db.ref(`locales/${localId}/pinPortero`).once('value');
          const pin = snap.val();
          if (String(pin) === input) {
            sessionStorage.setItem(`aforoya_portero_${localId}`, 'ok');
            viewPorteroOps(localId);
          } else {
            intentos++;
            input = '';
            renderDisplay();
            if (intentos >= 3) {
              bloqueadoHasta = Date.now() + 30000;
              intentos = 0;
              document.getElementById('pin-error').textContent = 'Demasiados intentos. Bloqueado 30s.';
              setTimeout(() => {
                document.getElementById('pin-error').textContent = '';
                bloqueadoHasta = null;
              }, 30000);
            } else {
              document.getElementById('pin-error').textContent = `PIN incorrecto (${3 - intentos} intentos)`;
            }
          }
        } catch (e) {
          document.getElementById('pin-error').textContent = 'Error de conexión';
          input = '';
          renderDisplay();
        }
      }
    });
  });
}

// ── PORTERO — OPERACIONES ────────────────────────────────────
function viewPorteroOps(localId) {
  mount(`
    <div class="portero-screen">
      <div class="portero-header">
        <span class="portero-venue" id="p-venue">Cargando…</span>
        <button class="btn-icon" onclick="sessionStorage.removeItem('aforoya_portero_${localId}');location.reload()">🔒</button>
      </div>
      <div class="aforo-display" id="p-aforo">
        <span class="aforo-current" id="p-current">—</span>
        <span class="aforo-slash">/</span>
        <span class="aforo-maximo" id="p-max">—</span>
      </div>
      <div class="aforo-label-txt">personas dentro</div>
      <div class="progress-wrap big">
        <div class="progress-bar" id="p-bar" style="width:0%"></div>
      </div>
      <div class="pct-label" id="p-pct">0%</div>
      <div class="portero-buttons">
        <button class="btn-op btn-entrada" id="btn-entrada" onclick="porteroAccion('${localId}','entrada')">
          <span>✅</span><span>ENTRADA</span>
        </button>
        <button class="btn-op btn-salida" id="btn-salida" onclick="porteroAccion('${localId}','salida')">
          <span>🚪</span><span>SALIDA</span>
        </button>
      </div>
      <div id="p-alert" class="portero-alert hidden"></div>
      <button class="btn-validar" onclick="validarCupon('${localId}')">🎟️ Validar cupón</button>
    </div>
  `);

  // Real-time listener
  db.ref(`locales/${localId}`).on('value', snap => {
    const local = snap.val();
    if (!local) return;
    const actual = local.aforoActual || 0;
    const maximo = local.aforoMaximo || 100;
    const pct = Math.round((actual / maximo) * 100);

    document.getElementById('p-venue').textContent = local.nombre || 'Local';
    document.getElementById('p-current').textContent = actual;
    document.getElementById('p-max').textContent = maximo;
    document.getElementById('p-pct').textContent = `${pct}%`;

    const bar = document.getElementById('p-bar');
    bar.style.width = `${pct}%`;

    const screen = document.querySelector('.portero-screen');
    const alert = document.getElementById('p-alert');
    const btnEntrada = document.getElementById('btn-entrada');

    screen.classList.remove('state-warn', 'state-full');
    alert.classList.add('hidden');
    btnEntrada.disabled = false;

    if (pct >= 100) {
      screen.classList.add('state-full');
      bar.style.background = 'var(--rojo)';
      alert.classList.remove('hidden');
      alert.textContent = '🚫 AFORO COMPLETO — No se permite entrada';
      btnEntrada.disabled = true;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else if (pct >= 80) {
      screen.classList.add('state-warn');
      bar.style.background = 'var(--amarillo)';
      alert.classList.remove('hidden');
      alert.textContent = `⚠️ Aforo al ${pct}% — Casi lleno`;
      if (pct === 80 && navigator.vibrate) navigator.vibrate(150);
    } else {
      bar.style.background = 'var(--verde)';
    }
  });
}

window.porteroAccion = async function(localId, tipo) {
  const maximo = parseInt(document.getElementById('p-max').textContent) || 100;
  try {
    await db.ref(`locales/${localId}/aforoActual`).transaction(val => {
      const current = val || 0;
      if (tipo === 'entrada') return Math.min(current + 1, maximo);
      if (tipo === 'salida') return Math.max(current - 1, 0);
      return val;
    });
    if (navigator.vibrate) navigator.vibrate(50);
  } catch (e) {
    showToast('Error al actualizar. Comprueba conexión.', 'error');
  }
};

window.validarCupon = async function(localId) {
  const token = prompt('Introduce el código del cupón:');
  if (!token) return;
  const snap = await db.ref(`locales/${localId}/sesionActual/cupones/${token}`).once('value');
  const cupon = snap.val();
  if (!cupon) { showToast('Cupón no encontrado', 'error'); return; }
  if (cupon.usado) { showToast('Cupón ya utilizado', 'warn'); return; }
  showModal('Validar cupón', `Descuento: ${cupon.descuento}%. ¿Marcar como usado?`, async () => {
    await db.ref(`locales/${localId}/sesionActual/cupones/${token}/usado`).set(true);
    showToast(`✅ Cupón validado: ${cupon.descuento}% descuento`, 'success');
  }, 'Validar');
};

// ── DUEÑO — AUTH ─────────────────────────────────────────────
function viewDuenoAuth(localId) {
  mount(`
    <div class="auth-screen">
      <div class="auth-logo">🏛️</div>
      <h2 class="auth-title">Panel del Dueño</h2>
      <form id="auth-form" class="auth-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="tu@email.com" required autocomplete="email">
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="auth-pass" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <p class="auth-error" id="auth-error"></p>
        <button type="submit" class="btn btn-full btn-verde">Entrar</button>
      </form>
    </div>
  `);

  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const errEl = document.getElementById('auth-error');
    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;
      // Determinar localId
      let lid = localId;
      if (lid === 'demo' || !lid) {
        const snap = await db.ref(`users/${uid}`).once('value');
        const userData = snap.val();
        lid = userData ? userData.localId : null;
      }
      if (!lid) { errEl.textContent = 'No tienes un local asignado.'; return; }
      viewDuenoDashboard(lid, uid);
    } catch (err) {
      errEl.textContent = 'Email o contraseña incorrectos';
    }
  });

  // Auto-login if already authenticated
  auth.onAuthStateChanged(user => {
    if (user) {
      db.ref(`users/${user.uid}`).once('value').then(snap => {
        const data = snap.val();
        const lid = (localId && localId !== 'demo') ? localId : (data ? data.localId : null);
        if (lid) viewDuenoDashboard(lid, user.uid);
      });
    }
  });
}

// ── DUEÑO — DASHBOARD ────────────────────────────────────────
function viewDuenoDashboard(localId, uid) {
  mount(`
    <div class="dueno-screen">
      <div class="dueno-header">
        <div>
          <span class="dueno-logo">🏛️</span>
          <span class="dueno-nombre" id="d-nombre">Cargando…</span>
        </div>
        <button class="btn-icon" onclick="firebase.auth().signOut().then(()=>location.reload())">🚪</button>
      </div>
      <nav class="tab-nav" id="tab-nav">
        <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
        <button class="tab-btn" data-tab="stats">Estadísticas</button>
        <button class="tab-btn" data-tab="incentivos">Incentivos</button>
        <button class="tab-btn" data-tab="config">Config</button>
        <button class="tab-btn" data-tab="qr">QR</button>
      </nav>
      <div class="tab-content" id="tab-content"></div>
    </div>
  `);

  let localData = null;

  db.ref(`locales/${localId}`).on('value', snap => {
    localData = snap.val();
    if (!localData) return;
    document.getElementById('d-nombre').textContent = localData.nombre || 'Mi Local';

    const activeTab = document.querySelector('.tab-btn.active');
    const tabId = activeTab ? activeTab.dataset.tab : 'dashboard';
    renderTab(tabId);
  });

  document.getElementById('tab-nav').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTab(btn.dataset.tab);
  });

  function renderTab(tab) {
    if (!localData) return;
    const el = document.getElementById('tab-content');
    switch (tab) {
      case 'dashboard': renderDashboard(el); break;
      case 'stats': renderStats(el); break;
      case 'incentivos': renderIncentivos(el); break;
      case 'config': renderConfig(el); break;
      case 'qr': renderQR(el); break;
    }
  }

  function renderDashboard(el) {
    const actual = localData.aforoActual || 0;
    const maximo = localData.aforoMaximo || 100;
    const pct = Math.round((actual / maximo) * 100);
    const entradas = localData.sesionActual ? Object.keys(localData.sesionActual.entradas || {}).length : 0;
    const salidas = localData.sesionActual ? Object.values(localData.sesionActual.entradas || {}).filter(e => e.salida).length : 0;

    let barColor = pct >= 100 ? 'var(--rojo)' : pct >= 80 ? 'var(--amarillo)' : 'var(--verde)';

    el.innerHTML = `
      <div class="dashboard-grid">
        <div class="d-card aforo-main">
          <p class="d-label">Aforo actual</p>
          <div class="big-counter ${pct >= 100 ? 'rojo' : pct >= 80 ? 'amarillo' : 'verde'}">
            <span id="d-actual">${actual}</span><span class="big-slash">/</span><span>${maximo}</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <p class="pct-label">${pct}% del aforo</p>
          <button class="btn btn-danger mt-2" onclick="resetAforo()">🔄 Reset manual</button>
        </div>
        <div class="d-card">
          <p class="d-label">Entradas hoy</p>
          <div class="stat-num verde">${entradas}</div>
        </div>
        <div class="d-card">
          <p class="d-label">Salidas hoy</p>
          <div class="stat-num rojo">${salidas}</div>
        </div>
        <div class="d-card">
          <p class="d-label">Dentro ahora</p>
          <div class="stat-num azul">${actual}</div>
        </div>
      </div>
    `;

    window.resetAforo = () => {
      showModal('Reset de aforo', '¿Seguro que quieres poner el aforo a 0?', async () => {
        await db.ref(`locales/${localId}/aforoActual`).set(0);
        showToast('Aforo reseteado', 'success');
      }, 'Resetear');
    };
  }

  function renderStats(el) {
    el.innerHTML = `
      <div class="stats-section">
        <h3 class="section-title">Ocupación por horas (hoy)</h3>
        <canvas id="chart-horas" class="chart-canvas"></canvas>
        <h3 class="section-title mt-3">Entradas por día de semana</h3>
        <canvas id="chart-dias" class="chart-canvas"></canvas>
        <div class="stats-pills">
          <div class="stat-pill">
            <span class="sp-label">Tiempo medio estancia</span>
            <span class="sp-val" id="sp-tiempo">—</span>
          </div>
          <div class="stat-pill">
            <span class="sp-label">% escanean QR salida</span>
            <span class="sp-val" id="sp-scan">—</span>
          </div>
        </div>
      </div>
    `;

    // Build hourly data from sesionActual
    const hourly = {};
    const entries = Object.values(localData.sesionActual?.entradas || {});
    entries.forEach(e => {
      if (e.entrada) {
        const h = new Date(e.entrada).getHours();
        hourly[h] = (hourly[h] || 0) + 1;
      }
    });

    // Day of week from historial
    const dayData = {};
    const historial = localData.historial || {};
    Object.values(historial).forEach(d => {
      const dow = new Date(Object.keys(historial).find(k => historial[k] === d)).getDay();
      dayData[dow === 0 ? 6 : dow - 1] = (dayData[dow === 0 ? 6 : dow - 1] || 0) + (d.totalEntradas || 0);
    });

    // Avg stay time
    let totalStay = 0, countStay = 0, countSalida = 0;
    entries.forEach(e => {
      if (e.entrada && e.salida) {
        totalStay += e.salida - e.entrada;
        countStay++;
        countSalida++;
      }
    });
    if (countStay > 0) document.getElementById('sp-tiempo').textContent = formatTime(totalStay / countStay);
    if (entries.length > 0) document.getElementById('sp-scan').textContent = `${Math.round((countSalida / entries.length) * 100)}%`;

    setTimeout(() => {
      const c1 = document.getElementById('chart-horas');
      const c2 = document.getElementById('chart-dias');
      if (c1) drawLineChart(c1, hourly, { maxCapacity: localData.aforoMaximo });
      if (c2) drawBarChart(c2, dayData);
    }, 50);
  }

  function renderIncentivos(el) {
    const inc = localData.incentivo || 'descuento';
    const desc = localData.descuentoPorcentaje || 10;
    const participaciones = Object.entries(localData.sesionActual?.sorteo?.participaciones || {});
    const ganador = localData.sesionActual?.sorteo?.ganador;

    el.innerHTML = `
      <div class="incentivos-section">
        <div class="d-card">
          <h3 class="section-title">Tipo de incentivo</h3>
          <div class="toggle-group">
            <label class="toggle-item ${inc === 'descuento' || inc === 'ambos' ? 'active' : ''}">
              <input type="checkbox" id="tog-descuento" ${inc === 'descuento' || inc === 'ambos' ? 'checked' : ''}>
              🎟️ Cupón descuento
            </label>
            <label class="toggle-item ${inc === 'sorteo' || inc === 'ambos' ? 'active' : ''}">
              <input type="checkbox" id="tog-sorteo" ${inc === 'sorteo' || inc === 'ambos' ? 'checked' : ''}>
              🎰 Sorteo mensual
            </label>
          </div>
          <div class="form-group mt-2">
            <label>% de descuento</label>
            <input type="number" id="inp-desc" value="${desc}" min="1" max="100" class="inp">
          </div>
          <button class="btn btn-verde mt-2" onclick="guardarIncentivos()">Guardar</button>
        </div>
        <div class="d-card mt-2">
          <h3 class="section-title">Sorteo — ${participaciones.length} participante${participaciones.length !== 1 ? 's' : ''}</h3>
          ${ganador ? `<div class="ganador-badge">🏆 Ganador: #${ganador}</div>` : ''}
          <div class="participaciones-list">
            ${participaciones.slice(-20).map(([tok, p]) => `
              <div class="part-item ${ganador === p.numero ? 'ganador' : ''}">
                <span class="part-num">#${p.numero}</span>
                <span class="part-token">${tok.slice(0, 8)}…</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-amarillo mt-2" onclick="realizarSorteo()">🎲 Realizar sorteo</button>
        </div>
      </div>
    `;

    window.guardarIncentivos = async () => {
      const togDesc = document.getElementById('tog-descuento').checked;
      const togSort = document.getElementById('tog-sorteo').checked;
      const pct = parseInt(document.getElementById('inp-desc').value);
      let inc2 = 'ninguno';
      if (togDesc && togSort) inc2 = 'ambos';
      else if (togDesc) inc2 = 'descuento';
      else if (togSort) inc2 = 'sorteo';
      await db.ref(`locales/${localId}`).update({ incentivo: inc2, descuentoPorcentaje: pct });
      showToast('Incentivos guardados', 'success');
    };

    window.realizarSorteo = async () => {
      const parts = Object.values(localData.sesionActual?.sorteo?.participaciones || {});
      if (!parts.length) { showToast('No hay participantes', 'warn'); return; }
      const winner = parts[Math.floor(Math.random() * parts.length)];
      showModal('Sorteo', `El ganador es el participante <strong>#${winner.numero}</strong>. ¿Confirmar?`, async () => {
        await db.ref(`locales/${localId}/sesionActual/sorteo/ganador`).set(winner.numero);
        showToast(`🏆 Ganador: #${winner.numero}`, 'success');
      }, 'Confirmar ganador');
    };
  }

  function renderConfig(el) {
    el.innerHTML = `
      <div class="config-section">
        <div class="d-card">
          <h3 class="section-title">Información del local</h3>
          <div class="form-group">
            <label>Nombre del local</label>
            <input type="text" id="cfg-nombre" value="${localData.nombre || ''}" class="inp">
          </div>
          <div class="form-group">
            <label>Aforo máximo</label>
            <input type="number" id="cfg-maximo" value="${localData.aforoMaximo || 100}" class="inp" min="1">
          </div>
          <div class="form-group">
            <label>PIN del portero (4 dígitos)</label>
            <input type="text" id="cfg-pin" value="${localData.pinPortero || ''}" maxlength="4" class="inp" pattern="[0-9]{4}">
          </div>
          <div class="form-group">
            <label>Hora de cierre (reset automático)</label>
            <input type="time" id="cfg-cierre" value="${localData.config?.horarioCierre || '06:00'}" class="inp">
          </div>
          <div class="form-group toggle-row">
            <label>Reset automático al cierre</label>
            <input type="checkbox" id="cfg-reset" class="toggle-check" ${localData.config?.resetAutomatico ? 'checked' : ''}>
          </div>
          <button class="btn btn-verde mt-2" onclick="guardarConfig()">💾 Guardar configuración</button>
        </div>
        <div class="d-card mt-2">
          <h3 class="section-title">Exportar datos</h3>
          <p class="d-label">Registro del día en formato CSV para inspecciones legales</p>
          <button class="btn btn-azul mt-1" onclick="exportarCSV()">📥 Descargar CSV</button>
        </div>
      </div>
    `;

    window.guardarConfig = async () => {
      const nombre = document.getElementById('cfg-nombre').value;
      const maximo = parseInt(document.getElementById('cfg-maximo').value);
      const pin = document.getElementById('cfg-pin').value;
      const cierre = document.getElementById('cfg-cierre').value;
      const reset = document.getElementById('cfg-reset').checked;
      if (!/^\d{4}$/.test(pin)) { showToast('El PIN debe tener 4 dígitos', 'error'); return; }
      await db.ref(`locales/${localId}`).update({
        nombre, aforoMaximo: maximo, pinPortero: pin,
        config: { horarioCierre: cierre, resetAutomatico: reset }
      });
      showToast('Configuración guardada', 'success');
    };

    window.exportarCSV = () => {
      const entradas = Object.entries(localData.sesionActual?.entradas || {}).map(([token, e]) => ({
        token: token.slice(0, 8),
        fecha: e.fecha || todayStr(),
        entrada: e.entrada ? new Date(e.entrada).toLocaleTimeString() : '',
        salida: e.salida ? new Date(e.salida).toLocaleTimeString() : '',
        duracion_min: e.entrada && e.salida ? Math.round((e.salida - e.entrada) / 60000) : ''
      }));
      exportCSV(entradas, `aforoya_${localData.nombre || localId}_${todayStr()}.csv`);
    };
  }

  function renderQR(el) {
    const base = `${location.origin}${location.pathname}`;
    el.innerHTML = `
      <div class="qr-section">
        <div class="qr-pair">
          <div class="qr-item qr-entrada">
            <h3>QR Entrada</h3>
            <div id="qr-ent" class="qr-holder"></div>
            <p class="qr-url">${base}?local=${localId}&tipo=entrada</p>
            <button class="btn btn-verde mt-1" onclick="downloadQR('qr-ent','entrada')">⬇️ Descargar PNG</button>
          </div>
          <div class="qr-item qr-salida">
            <h3>QR Salida</h3>
            <div id="qr-sal" class="qr-holder"></div>
            <p class="qr-url">${base}?local=${localId}&tipo=salida</p>
            <button class="btn btn-rojo mt-1" onclick="downloadQR('qr-sal','salida')">⬇️ Descargar PNG</button>
          </div>
        </div>
        <p class="qr-hint">Imprime y plastifica estos QR para colocarlos en el local</p>
      </div>
    `;

    setTimeout(() => {
      new QRCode(document.getElementById('qr-ent'), {
        text: `${base}?local=${localId}&tipo=entrada`,
        width: 200, height: 200, colorDark: '#00ff88', colorLight: '#141414'
      });
      new QRCode(document.getElementById('qr-sal'), {
        text: `${base}?local=${localId}&tipo=salida`,
        width: 200, height: 200, colorDark: '#ff3355', colorLight: '#141414'
      });
    }, 50);

    window.downloadQR = (id, tipo) => {
      const canvas = document.querySelector(`#${id} canvas`);
      if (!canvas) { showToast('QR no listo aún', 'warn'); return; }

      // Crear canvas con padding y color
      const size = 240;
      const out = document.createElement('canvas');
      out.width = size; out.height = size;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(canvas, 20, 20, 200, 200);

      out.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `aforoya_qr_${tipo}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', router);
