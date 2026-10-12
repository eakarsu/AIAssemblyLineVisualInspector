const { createClient, escapeHtml, normalizeList } = window.InspectorApi;
const apiPort = Number(window.location.port || 80) - 1;
const apiBase = window.localStorage.getItem('inspector.api') || `${window.location.protocol}//${window.location.hostname}:${apiPort}/api`;
let token = window.sessionStorage.getItem('inspector.token') || '';
const request = createClient({ baseUrl: apiBase, getToken: () => token });
const nativeStudio = window.NativeWorkflowStudio.mount({ element: document.getElementById('native-ai-studio'), config: window.nativeWorkflowConfig, request });

const byId = (id) => document.getElementById(id);

const demoCredentialsButton = document.createElement('button');
demoCredentialsButton.type = 'button';
demoCredentialsButton.textContent = 'Fill demo credentials';
demoCredentialsButton.setAttribute('aria-label', 'Fill demo credentials');
demoCredentialsButton.addEventListener('click', async () => {
  try {
    const credentials = await request('/auth/demo-credentials');
    byId('login-form').elements.email.value = credentials.email;
    byId('login-form').elements.password.value = credentials.password;
    setStatus('Demo credentials filled. Select Sign in when ready.');
  } catch (error) { setStatus('Demo credentials are not configured for this server.', 'error'); }
});
byId('login-form').insertBefore(demoCredentialsButton, byId('login-form').querySelector('button'));

function setStatus(message, kind = '') {
  const node = byId('status');
  node.textContent = message;
  node.className = `status ${kind}`;
}

const recordTables = {};
let recordTableSeq = 0;
function table(rows, columns, endpoint, title) {
  if (!rows.length) return '<p class="empty">No records returned.</p>';
  const head = columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = rows.map((row, index) => `<tr class="record-row" data-row="${index}" tabindex="0" role="button" aria-label="Open ${escapeHtml(title || 'record')} details">${columns.map(([key]) => `<td>${escapeHtml(row[key] ?? '—')}</td>`).join('')}</tr>`).join('');
  const id = `records-${++recordTableSeq}`;
  if (endpoint) recordTables[id] = { rows, endpoint, title };
  return `<div class="record-table-host"${endpoint ? ` data-record-table="${id}"` : ''}><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// Row details with Edit / Delete / Cancel, reusing the studio dialog styles.
const RECORD_SKIP_KEYS = new Set(['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt']);
const inputValue = (value) => (value == null ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
const parseValue = (original, text) => {
  if (original !== null && typeof original === 'object') { try { return JSON.parse(text); } catch { return original; } }
  if (typeof original === 'number') { const num = Number(text); return Number.isNaN(num) ? original : num; }
  if (typeof original === 'boolean') return text === 'true';
  return text;
};
async function openRecord(row, endpoint, title) {
  const overlay = document.createElement('div');
  overlay.className = 'native-vanilla-backdrop';
  let record = { ...row };
  let editing = false;
  let busy = false;
  const close = () => { if (busy) return; overlay.remove(); document.body.style.overflow = ''; };
  function draw() {
    const keys = Object.keys(record).filter((key) => !RECORD_SKIP_KEYS.has(key));
    overlay.innerHTML = `<section class="native-vanilla-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-heading" tabindex="-1"><header><h2 id="record-dialog-heading">${escapeHtml(title || 'Record')} · ${escapeHtml(record.id ?? '')}</h2><button type="button" data-dialog="cancel" ${busy ? 'disabled' : ''}>Cancel</button></header><div class="native-vanilla-dialog-body">${editing ? `<form data-record-form><div class="native-vanilla-fields">${keys.map((key) => `<label>${escapeHtml(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '))}<textarea name="${escapeHtml(key)}">${escapeHtml(inputValue(record[key]))}</textarea></label>`).join('')}</div></form>` : window.BrowserAIReport.render(record)}<p role="alert" data-record-error></p></div><footer><button type="button" data-dialog="${editing ? 'save' : 'edit'}" ${busy ? 'disabled' : ''}>${editing ? 'Save changes' : 'Edit'}</button><button type="button" class="danger" data-dialog="delete" ${busy ? 'disabled' : ''}>Delete</button><button type="button" data-dialog="cancel" ${busy ? 'disabled' : ''}>Cancel</button></footer></section>`;
    overlay.querySelector('[role=dialog]').focus();
  }
  overlay.addEventListener('click', async (event) => {
    if (event.target === overlay) { close(); return; }
    const action = event.target.closest('[data-dialog]')?.dataset.dialog;
    if (!action) return;
    if (action === 'cancel') { close(); return; }
    if (action === 'edit') {
      try {
        const full = await request(`${endpoint}/${encodeURIComponent(row.id)}`);
        if (full && typeof full === 'object') record = full.data && typeof full.data === 'object' ? full.data : full;
      } catch { /* keep the row we already have */ }
      editing = true; draw(); return;
    }
    if (action === 'delete' && !window.confirm('Delete this record? This cannot be undone.')) return;
    let payload = {};
    if (action === 'save') {
      for (const node of overlay.querySelectorAll('[data-record-form] textarea')) payload[node.name] = parseValue(record[node.name], node.value);
    }
    busy = true;
    overlay.querySelectorAll('button').forEach((node) => { node.disabled = true; });
    try {
      await request(`${endpoint}/${encodeURIComponent(row.id)}`, { method: action === 'delete' ? 'DELETE' : 'PUT', ...(action === 'save' ? { body: JSON.stringify(payload) } : {}) });
      busy = false; close(); await refresh();
    } catch (error) {
      busy = false;
      overlay.querySelectorAll('button').forEach((node) => { node.disabled = false; });
      overlay.querySelector('[data-record-error]').textContent = error.message;
    }
  });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  draw();
}
document.addEventListener('click', (event) => {
  const host = event.target.closest('[data-record-table]');
  if (!host) return;
  const tr = event.target.closest('tr.record-row');
  if (!tr || !host.contains(tr)) return;
  const entry = recordTables[host.dataset.recordTable];
  if (entry) openRecord(entry.rows[Number(tr.dataset.row)], entry.endpoint, entry.title);
});
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('record-row')) {
    event.preventDefault(); event.target.click();
  }
});

function showAuthenticated(value){ nativeStudio.setAuthenticated(value);
  byId('login-panel').hidden = value;
  byId('workspace').hidden = !value;
  byId('logout').hidden = !value;
}

async function refresh() {
  setStatus('Loading current inspection data…', 'loading');
  byId('refresh').disabled = true;
  try {
    const [dashboard, inspections, lines, alertsResponse] = await Promise.all([
      request('/dashboard'), request('/inspections?limit=20'),
      request('/production-lines?limit=20'), request('/alerts?acknowledged=false&limit=20')
    ]);
    const cards = [
      ['Inspections today', dashboard.total_inspections_today], ['Pass rate', `${dashboard.pass_rate_today || 0}%`],
      ['Active lines', dashboard.active_lines], ['Open alerts', dashboard.open_alerts]
    ];
    byId('metrics').innerHTML = cards.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`).join('');
    byId('lines').innerHTML = table(normalizeList(lines), [['name', 'Line'], ['product_type', 'Product'], ['status', 'Status'], ['speed_units_per_hour', 'Units/hour']], '/production-lines', 'Production line');
    const alerts = normalizeList(alertsResponse);
    byId('alerts').innerHTML = alerts.length ? alerts.map((item) => `<div class="alert"><strong>${escapeHtml(item.title || item.type)}</strong><span>${escapeHtml(item.severity)} · ${escapeHtml(item.production_line_name || 'Unassigned')}</span><p>${escapeHtml(item.message)}</p></div>`).join('') : '<p class="empty">No open alerts.</p>';
    byId('inspections').innerHTML = table(normalizeList(inspections), [['inspected_at', 'Inspected'], ['production_line_name', 'Line'], ['product_name', 'Product'], ['status', 'Result'], ['defect_count', 'Defects'], ['confidence_score', 'Confidence']], '/inspections', 'Inspection');
    byId('updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('Quality data loaded.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    if (/token|access denied|unauthorized|401/i.test(error.message)) logout();
  } finally { byId('refresh').disabled = false; }
}

async function login(event) {
  event.preventDefault();
  setStatus('Signing in…', 'loading');
  const form = new FormData(event.currentTarget);
  try {
    const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    token = result.token;
    window.sessionStorage.setItem('inspector.token', token);
    showAuthenticated(true);
    await refresh();
  } catch (error) { setStatus(error.message, 'error'); }
}

function logout() {
  token = '';
  window.sessionStorage.removeItem('inspector.token');
  showAuthenticated(false);
  setStatus('Signed out.');
}

byId('login-form').addEventListener('submit', login);
byId('refresh').addEventListener('click', refresh);
byId('logout').addEventListener('click', logout);
showAuthenticated(Boolean(token));
if (token) refresh();
