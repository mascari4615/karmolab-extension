import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreApi, requireEnv } from '../scripts/store-api.mjs';

const product = '2aa974b2-e51b-4eab-8cad-89e84b1e03c6';
const uploadId = '11111111-1111-1111-1111-111111111111';
const publishId = '22222222-2222-2222-2222-222222222222';
const edgeEnv = { EDGE_PRODUCT_ID: product, EDGE_CLIENT_ID: 'client', EDGE_API_KEY: 'fake-private-key' };
const chromeEnv = { CWS_PUBLISHER_ID: 'publisher', CWS_EXTENSION_ID: 'a'.repeat(32), CWS_CLIENT_ID: 'client', CWS_CLIENT_SECRET: 'fake-secret', CWS_REFRESH_TOKEN: 'fake-refresh' };
const response = (data, status = 200, location) => new Response(JSON.stringify(data), { status, headers: location ? { Location: location } : {} });
const ok = { status: 'Succeeded' };

function transport(replies) {
  const calls = [];
  const api = createStoreApi({ attempts: 2, delayMs: 0, sleep: async () => {}, fetcher: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'error');
    if (!replies.length) throw new Error('unexpected request');
    const next = replies.shift(); if (next instanceof Error) throw next; return next;
  } });
  return { api, calls };
}

test('Edge uploads ZIP, waits for success, then submits certification notes', async () => {
  const t = transport([response({}, 202, uploadId), response({ status: 'InProgress' }), response(ok), response({}, 202, publishId), response(ok)]);
  const receipt = {}; const saved = [];
  await t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'test notes', receipt, r => saved.push({ ...r }));
  assert.equal(receipt.status, 'SUBMISSION_ACCEPTED'); assert.equal(receipt.reviewStatus, 'CHECK_PARTNER_CENTER');
  assert.equal(t.calls[0].options.headers['Content-Type'], 'application/zip');
  assert.deepEqual(JSON.parse(t.calls[3].options.body), { notes: 'test notes' });
  assert.equal(saved.some(r => r.uploadOperationId === uploadId && !r.uploadSucceeded), true);
});
test('failed Edge upload never publishes', async () => {
  const t = transport([response({}, 202, uploadId), response({ status: 'Failed', errorCode: 'InvalidPackage' })]);
  await assert.rejects(t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', {}, () => {}), /InvalidPackage/);
  assert.equal(t.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('Edge resume polls existing operation without duplicate upload or publish', async () => {
  const t = transport([response(ok), response(ok)]);
  const receipt = { uploadOperationId: uploadId, publishOperationId: publishId };
  await t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', receipt, () => {});
  assert.equal(t.calls.every(c => !c.options.method), true);
});
test('Edge response loss does not retry mutation', async () => {
  const t = transport([new Error('network interrupted')]); const receipt = {};
  await assert.rejects(t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', receipt, () => {}));
  await assert.rejects(t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', receipt, () => {}), /outcome unknown/);
  assert.equal(t.calls.length, 1);
});
test('operation IDs never redirect credentials to an external host', async () => {
  const t = transport([response({}, 202, `https://evil.example/${uploadId}`), response(ok), response({}, 202, publishId), response(ok)]);
  await t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', {}, () => {});
  assert.equal(t.calls.every(c => c.url.startsWith('https://api.addons.microsoftedge.microsoft.com/')), true);
});
test('bounded polling stops and preserves receipt before publish', async () => {
  const t = transport([response({}, 202, uploadId), response({ status: 'InProgress' }), response({ status: 'InProgress' })]);
  const receipt = {};
  await assert.rejects(t.api.edge(edgeEnv).submit(Buffer.from('zip'), 'notes', receipt, () => {}), /resume/);
  assert.equal(receipt.uploadOperationId, uploadId); assert.equal(receipt.publishOperationId, undefined);
});
test('Chrome refresh, ZIP upload and review submission use v2 endpoints', async () => {
  const t = transport([response({ access_token: 'fake-access' }), response({}), response({ uploadState: 'IN_PROGRESS' }), response({ lastAsyncUploadState: 'SUCCEEDED' }), response({ state: 'PENDING_REVIEW' })]);
  const provider = await t.api.chrome(chromeEnv); const receipt = {};
  await provider.submit(Buffer.from('zip'), '0.1.1', receipt, () => {});
  assert.equal(receipt.status, 'PENDING_REVIEW');
  assert.match(t.calls[2].url, /\/upload\/v2\/publishers\/publisher\/items\/a+:upload$/);
  assert.deepEqual(JSON.parse(t.calls[4].options.body), { publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true });
  assert.equal(JSON.stringify(receipt).includes('fake-'), false);
});
test('Chrome existing review of same version is idempotent', async () => {
  const t = transport([response({ access_token: 'token' }), response({ submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.1.1' }] } })]);
  const receipt = {}; await (await t.api.chrome(chromeEnv)).submit(Buffer.from('zip'), '0.1.1', receipt, () => {});
  assert.equal(receipt.status, 'PENDING_REVIEW'); assert.equal(t.calls.length, 2);
});
test('Chrome other version in review is preserved', async () => {
  const t = transport([response({ access_token: 'token' }), response({ submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.1.0' }] } })]);
  await assert.rejects((await t.api.chrome(chromeEnv)).submit(Buffer.from('zip'), '0.1.1', {}, () => {}), /Another Chrome version/);
  assert.equal(t.calls.length, 2);
});
test('Chrome failed upload does not submit', async () => {
  const t = transport([response({ access_token: 'token' }), response({}), response({ uploadState: 'FAILED' })]);
  await assert.rejects((await t.api.chrome(chromeEnv)).submit(Buffer.from('zip'), '0.1.1', {}, () => {}), /upload failed/);
  assert.equal(t.calls.length, 3);
});
test('missing credentials and HTTP failures never print secret values', async () => {
  assert.throws(() => requireEnv({ EDGE_API_KEY: 'private' }, ['EDGE_CLIENT_ID', 'EDGE_API_KEY']), /Missing configuration: EDGE_CLIENT_ID$/);
  const t = transport([response({ secret: 'private' }, 401)]);
  await assert.rejects(t.api.edge(edgeEnv).read('upload', uploadId), /^Error: Store request failed: HTTP 401$/);
});
