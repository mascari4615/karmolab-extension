import test from 'node:test';
import assert from 'node:assert/strict';

let sequence = 0;
async function harness({ failSave = false, active = false } = {}) {
  let listener, sites = {}, session = active ? { active: true, percent: 150 } : { active: false };
  const calls = [], registered = new Map();
  const runtime = { id: 'fixture', getURL: file => 'chrome-extension://fixture/' + file,
    getContexts: async () => [{}], onMessage: { addListener: callback => { listener = callback; } },
    sendMessage: async message => {
      calls.push(message.operation);
      if (message.operation === 'status') return { ok: true, ...session };
      if (message.operation === 'stop') session = { active: false };
      else session = { active: true, percent: message.percent };
      return { ok: true, ...session };
    } };
  globalThis.chrome = { runtime,
    storage: { local: { get: async () => ({ volumeSites: structuredClone(sites) }), set: async value => {
      if (failSave) throw new Error('Disk full');
      await new Promise(resolve => setTimeout(resolve, 5)); sites = value.volumeSites;
    } } },
    scripting: { getRegisteredContentScripts: async ({ids}) => ids.filter(id=>registered.has(id)), registerContentScripts: async scripts => scripts.forEach(script=>registered.set(script.id,script)), executeScript: async () => {} },
    tabCapture: { getMediaStreamId: async () => 'own-fixture-stream' },
    tabs: { get: async id => ({id,url:`https://site${id}.example/watch`}), sendMessage: async () => {}, onRemoved: {addListener(){}}, onUpdated: {addListener(){}} } };
  await import('../features/volume-background.mjs?fixture=' + ++sequence);
  const request = (message, sender = { id: 'fixture', url: runtime.getURL('popup.html') }) => new Promise(resolve => {
    if (listener(message, sender, resolve) !== true) resolve(undefined);
  });
  return { request, calls, sites: () => sites, session: () => session };
}

test('failed persistence releases newly captured audio and does not save a false success', async () => {
  const h = await harness({ failSave: true });
  const result = await h.request({type:'volume-apply',tabId:1,origin:'https://site1.example',percent:200});
  assert.equal(result.ok, false); assert.match(result.error,/Disk full/);
  assert.deepEqual(h.calls,['status','start','stop']);
  assert.deepEqual(h.sites(),{}); assert.equal(h.session().active,false);
});

test('failed persistence restores the previous live gain', async () => {
  const h = await harness({ failSave: true, active: true });
  assert.equal((await h.request({type:'volume-apply',tabId:1,origin:'https://site1.example',percent:50})).ok,false);
  assert.equal(h.session().percent,150); assert.deepEqual(h.sites(),{});
});

test('simultaneous site changes preserve both preferences and content pages cannot apply volume', async () => {
  const h = await harness();
  const results = await Promise.all([1,2].map(tabId=>h.request({type:'volume-apply',tabId,origin:`https://site${tabId}.example`,percent:tabId*25})));
  assert.ok(results.every(result=>result.ok));
  assert.deepEqual(h.sites(),{'https://site1.example':25,'https://site2.example':50});
  assert.equal(await h.request({type:'volume-apply',tabId:1,origin:'https://site1.example',percent:300},{id:'fixture',url:'https://site1.example/watch',tab:{id:1}}),undefined);
  assert.deepEqual(h.sites(),{'https://site1.example':25,'https://site2.example':50});
});
