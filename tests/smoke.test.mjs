import assert from 'node:assert/strict';
import test from 'node:test';

const webUrl = process.env.WEB_URL ?? 'https://music-web-vemj.onrender.com/';
const apiUrl = process.env.API_URL ?? 'https://music-api-64yc.onrender.com';

test('web demo responds successfully', async () => {
  const response = await fetch(webUrl);

  assert.equal(response.status, 200);
});

test('API health endpoint reports the API service', async () => {
  const response = await fetch(`${apiUrl}/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, { ok: true, service: '@music/api' });
});