import test from 'node:test';
import assert from 'node:assert/strict';
let sequence = 0;
async function harness({ saved = [], failSave = false, permission = true } = {}) {
  let listener, sites = [...saved];
  const registered = new Map(), injected = [];
  const id = 'dark-' + Buffer.from('https://site1.example/*').toString('hex');
  const script = { id, matches: ['https://site1.example/*'], js: ['features/dark-mode-engine.js', 'features/dark-mode-page.js'] };
  if (saved.length) registered.set(id, script);
  globalThis.chrome = {
    runtime: { id: 'fixture', getURL: file => 'chrome-extension://fixture/' + file, onMessage: { addListener: fn => { listener = fn; } } },
    permissions: { contains: async () => permission },
    tabs: { get: async id => ({ id, url: `https://site${id}.example/article` }), query: async () => [{id: 1}, {id: 2}] },
    storage: { local: { get: async () => ({ darkModeSites: [...sites] }), set: async values => { if (failSave) throw new Error('Disk full'); sites = values.darkModeSites; } } },
    scripting: {
      getRegisteredContentScripts: async ({ids}) => ids ? ids.map(id => registered.get(id)).filter(Boolean) : [...registered.values()],
      updateContentScripts: async scripts => scripts.forEach(script => registered.set(script.id, { ...registered.get(script.id), ...script })),
      registerContentScripts: async scripts => scripts.forEach(script => registered.set(script.id, script)),
      unregisterContentScripts: async ({ids}) => ids.forEach(id => registered.delete(id)),
      executeScript: async config => { injected.push(config); return [{ result: false }]; },
    },
  };
  await import('../features/dark-mode-background.mjs?fixture=' + ++sequence);
  const sender = { id: 'fixture', url: 'chrome-extension://fixture/popup.html' };
  return { sites: () => sites, registered, injected, request: (message, source = sender) => new Promise(resolve => {
    if (listener({ type: 'dark-mode-apply', tabId: 1, pattern: 'https://site1.example/*', ...message }, source, resolve) !== true) resolve(undefined);
  }) };
}
test('failed enable rolls back automatic injection and keeps saved sites unchanged', async () => {
  const h = await harness({ failSave: true });
  const result = await h.request({ enabled: true });
  assert.equal(result.ok, false); assert.match(result.error, /Disk full/);
  assert.deepEqual(h.sites(), []); assert.equal(h.registered.size, 0); assert.equal(h.injected.length, 0);
});
test('failed disable restores the previous automatic registration', async () => {
  const h = await harness({ saved: ['https://site1.example/*'], failSave: true });
  assert.equal((await h.request({ enabled: false })).ok, false);
  assert.deepEqual(h.sites(), ['https://site1.example/*']); assert.equal(h.registered.size, 1);
});
test('site navigation and denied permissions cannot enable another site', async () => {
  const h = await harness({ permission: false });
  assert.equal((await h.request({ enabled: true })).ok, false);
  assert.equal((await h.request({ enabled: true, pattern: 'https://other.example/*' })).ok, false);
  assert.equal(await h.request({ enabled: true }, { id: 'fixture', url: 'https://site1.example/', tab: {id: 1} }), undefined);
  assert.deepEqual(h.sites(), []); assert.equal(h.registered.size, 0);
});
test('serialized changes preserve other sites and disabling refreshes every open tab', async () => {
  const h = await harness();
  const results = await Promise.all([1,2].map(tabId => h.request({ enabled: true, tabId, pattern: `https://site${tabId}.example/*` })));
  assert.ok(results.every(result => result.ok)); assert.equal(h.sites().length, 2);
  assert.equal((await h.request({enabled: false})).ok, true);
  assert.deepEqual(h.sites(), ['https://site2.example/*']);
  assert.equal(h.injected.filter(call => call.func && !call.files).length, 6);
});
