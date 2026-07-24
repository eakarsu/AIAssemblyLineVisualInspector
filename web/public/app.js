const { createClient, escapeHtml, normalizeList } = window.InspectorApi;
const apiPort = Number(window.location.port || 80) - 1;
const apiBase = window.localStorage.getItem('inspector.api') || `${window.location.protocol}//${window.location.hostname}:${apiPort}/api`;
let token = window.sessionStorage.getItem('inspector.token') || '';
const request = createClient({ baseUrl: apiBase, getToken: () => token });
const byId = (id) => document.getElementById(id);

function setStatus(message, kind = '') {
  const node = byId('status');
  node.textContent = message;
  node.className = `status ${kind}`;
}

function table(rows, columns) {
  if (!rows.length) return '<p class="empty">No records returned.</p>';
  const head = columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map(([key]) => `<td>${escapeHtml(row[key] ?? '—')}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function showAuthenticated(value) {
  byId('login-panel').hidden = value;
  byId('workspace').hidden = !value;
  byId('logout').hidden = !value;
}

async function refresh() {
  setStatus('Loading current inspection data…', 'loading');
  byId('refresh').disabled = true;
  try {
    const [dashboard, inspections] = await Promise.all([
      request('/dashboard'), request('/inspections?limit=12')
    ]);
    const cards = [
      ['Inspections today', dashboard.total_inspections_today], ['Pass rate', `${dashboard.pass_rate_today || 0}%`],
      ['Active lines', dashboard.active_lines], ['Open alerts', dashboard.open_alerts]
    ];
    byId('metrics').innerHTML = cards.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`).join('');
    byId('lines').innerHTML = table(normalizeList(dashboard.line_status), [['name', 'Line'], ['product_type', 'Product'], ['status', 'Status'], ['speed_units_per_hour', 'Units/hour']]);
    const alerts = normalizeList(dashboard.recent_alerts);
    byId('alerts').innerHTML = alerts.length ? alerts.map((item) => `<div class="alert"><strong>${escapeHtml(item.title || item.type)}</strong><span>${escapeHtml(item.severity)} · ${escapeHtml(item.production_line_name || 'Unassigned')}</span><p>${escapeHtml(item.message)}</p></div>`).join('') : '<p class="empty">No open alerts.</p>';
    byId('inspections').innerHTML = table(normalizeList(inspections), [['inspected_at', 'Inspected'], ['production_line_name', 'Line'], ['product_name', 'Product'], ['status', 'Result'], ['defect_count', 'Defects'], ['confidence_score', 'Confidence']]);
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
