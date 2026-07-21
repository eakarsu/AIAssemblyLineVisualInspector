const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, escapeHtml, normalizeList } = require('../public/api');

test('normalizes paginated inspection responses', () => {
  assert.deepEqual(normalizeList({ data: [{ id: 7 }] }), [{ id: 7 }]);
  assert.deepEqual(normalizeList(null), []);
});

test('client sends the bearer token and reports backend errors', async () => {
  let authorization;
  const client = createClient({ baseUrl: 'http://api.test', getToken: () => 'quality-token', fetchImpl: async (_url, options) => {
    authorization = options.headers.Authorization;
    return { ok: false, status: 503, json: async () => ({ error: 'camera gateway unavailable' }) };
  }});
  await assert.rejects(client('/dashboard'), /camera gateway unavailable/);
  assert.equal(authorization, 'Bearer quality-token');
  assert.equal(escapeHtml('<unsafe>'), '&lt;unsafe&gt;');
});
