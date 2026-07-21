(function expose(factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.InspectorApi = api;
})(function createModule() {
  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload && payload.data) ? payload.data : [];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function createClient({ baseUrl, getToken, fetchImpl }) {
    const requestFetch = fetchImpl || fetch;
    return async function request(endpoint, options = {}) {
      const token = getToken();
      const response = await requestFetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      return payload;
    };
  }

  return { createClient, escapeHtml, normalizeList };
});
