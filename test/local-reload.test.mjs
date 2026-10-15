import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { storeManifest } from '../dev/build.mjs';
import { reloadLocal } from '../scripts/reload-local.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('store manifest excludes local receiver and development permissions', () => {
  const source = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  const packed = storeManifest(source);
  assert.equal(packed.background, undefined);
  assert.ok(!packed.permissions.includes('alarms'));
  assert.ok(!packed.host_permissions.includes('http://127.0.0.1/*'));
  assert.ok(packed.content_scripts.every(item => item.js.every(file => !file.startsWith('dev/'))));
  assert.ok(source.background);
  assert.equal(packed.version, source.version);
});

test('local reload rejects web origins and cannot report success without a new boot acknowledgement', async () => {
  const id = 'a'.repeat(32);
  const pending = reloadLocal({ root, id, port: 0, timeoutMs: 150, ready: async port => {
    const response = await fetch(`http://127.0.0.1:${port}/karmolab/reload?id=${id}`, { headers: { Origin: 'https://example.com', 'X-KarmoLab-Reload': '1' } });
    assert.equal(response.status, 403);
    const simple = await fetch(`http://127.0.0.1:${port}/karmolab/reload?id=${id}`);
    assert.equal(simple.status, 403);
  } });
  await assert.rejects(pending, /No KarmoLab receiver response/);
});

test('receiver timeout begins after asynchronous server readiness completes', async () => {
  let ready = false;
  await assert.rejects(reloadLocal({ root, id: 'b'.repeat(32), port: 0, timeoutMs: 10, ready: async () => {
    await new Promise(resolve => setTimeout(resolve, 40));
    ready = true;
  } }), /No KarmoLab receiver response/);
  assert.equal(ready, true);
});
