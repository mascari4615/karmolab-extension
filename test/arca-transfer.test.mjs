import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sourceRoot = process.env.ARCA_DEV_ROOT;
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const transfer = await read('features/arca/transfer.js');
function storage(initial = {}) {
  const data = structuredClone(initial);
  return { data,
    async get(query) {
      if (!query) return structuredClone(data);
      if (typeof query === 'string') return { [query]: structuredClone(data[query]) };
      return Object.fromEntries((Array.isArray(query) ? query : Object.keys(query)).map(key => [key, structuredClone(data[key] ?? query[key])]));
    },
    async set(value) { Object.assign(data, structuredClone(value)); },
    async remove(keys) { for (const key of [keys].flat()) delete data[key]; },
  };
}
function context(chrome) { return vm.createContext({ chrome, structuredClone, TextEncoder, crypto: globalThis.crypto, console, URL, Date, setTimeout }); }
const event = () => ({ addListener() {} });
function request(handler, msg, sender) {
  return new Promise((resolve, reject) => {
    try { if (!handler(msg, sender, resolve)) resolve(undefined); } catch (error) { reject(error); }
  });
}
test('transfer only exports Arca allowlist; destination settings and unrelated data survive', () => {
  const ctx = context({}); vm.runInContext(transfer, ctx);
  const incoming = { ingestUrl: 'private', secret: 'private', blocklist: { arca: { a: { hideAll: true } }, youtube: { secret: {} } }, karmoSettings: { arca: { exBest: false, minRec: 3 } }, 'karmoVisited:c:1': 50 };
  const selected = ctx.KarmoArcaTransfer.select(incoming);
  assert.deepEqual(Object.keys(selected).sort(), ['blocklist', 'karmoSettings', 'karmoVisited:c:1'].sort());
  assert.deepEqual(Object.keys(selected.blocklist), ['arca']);
  const target = { blocklist: { youtube: { y: {} }, arca: { a: { hideAll: false }, b: {} } }, karmoSettings: { arca: { exBest: true } }, 'karmoVisited:c:1': 30 };
  const result = ctx.KarmoArcaTransfer.merge(incoming, target);
  assert.equal(result.karmoSettings.arca.exBest, true);
  assert.equal(result.karmoSettings.arca.minRec, 3);
  assert.equal(result.blocklist.arca.a.hideAll, false);
  assert.ok(result.blocklist.youtube.y);
  assert.equal(result['karmoVisited:c:1'], 50);
});
test('special account names remain own dictionary keys', () => {
  const ctx = context({}); vm.runInContext(transfer, ctx);
  const data = JSON.parse('{"blocklist":{"arca":{"__proto__":{"hideAll":true},"constructor":{"hideAll":true}}}}');
  const out = ctx.KarmoArcaTransfer.merge(data, {});
  assert.equal(Object.hasOwn(out.blocklist.arca, '__proto__'), true);
  assert.equal(out.blocklist.arca.constructor.hideAll, true);
  assert.equal({}.hideAll, undefined);
});
test('oversize transfer fails before exporting private source data', () => {
  const ctx = context({}); vm.runInContext(transfer, ctx);
  assert.throws(() => ctx.KarmoArcaTransfer.select({ karmoLikedView: '한'.repeat(3000000) }), /8MB/);
});
test('legacy settings never carry other site containers', () => {
  const ctx = context({}); vm.runInContext(transfer, ctx);
  const out = ctx.KarmoArcaTransfer.select({ karmoSettings: { linkStyle: 'tint', youtube: { secret: 'private' }, exBest: false } });
  assert.equal(out.karmoSettings.arca.youtube, undefined);
  assert.equal(out.karmoSettings.arca.exBest, false);
});

async function system({ source = true, failCommit = false, failEnable = false, failRegister = false, lostCommit = false, lostCancel = false } = {}) {
  const targetId = 'jblnjmafdicfkgfghgcgijkconpomgkc';
  let external;
  let write;
  const original = { secret: 'keep private', blocklist: { arca: { a: { name: 'A', hideAll: true } } }, karmoSettings: { arca: { autoBlockChannels: ['example'] } }, 'karmoVisited:c:1': 123 };
  const from = storage(original);
  if (source) {
    const dev = context({ storage: { local: from }, runtime: { id: 'lojdjbbekohhajlefkklkfoddldpheom', onMessage: { addListener(fn) { write = fn; } }, onMessageExternal: { addListener(fn) { external = fn; } } } });
    vm.runInContext(transfer, dev);
    vm.runInContext(sourceRoot ? await readFile(sourceRoot + '/block-store.js', 'utf8') : await read('features/arca/block-store.js'), dev);
    vm.runInContext(sourceRoot ? await readFile(sourceRoot + '/arca-transfer.js', 'utf8') : await read('scripts/arca-dev-receiver.js'), dev);
  }
  const to = storage({ blocklist: { youtube: { x: {} } } });
  const savedSet = to.set.bind(to);
  to.set = async value => { if (failEnable && value.arcaFeature?.enabled) throw new Error('disk full'); return savedSet(value); };
  let handler;
  const scripts = [];
  const chrome = {
    storage: { local: to }, permissions: { async contains() { return true; }, onRemoved: event() },
    tabs: { async create() {} },
    scripting: {
      async getRegisteredContentScripts() { return [...scripts]; },
      async registerContentScripts(value) { if (failRegister) throw new Error('register failed'); scripts.push(...value); },
      async unregisterContentScripts() { scripts.length = 0; },
    },
    runtime: { id: targetId, getURL: file => 'chrome-extension://' + targetId + '/' + file, onStartup: event(), onInstalled: event(), onMessage: { addListener(fn) { handler = fn; } },
      async sendMessage(_id, msg) {
        if (!source) throw new Error('Could not establish connection. Receiving end does not exist.');
        if (failCommit && msg.type === 'arca.transfer.commit') return { ok: false, error: 'commit failed' };
        if (lostCommit && msg.type === 'arca.transfer.commit') { await request(external, msg, { id: targetId }); return undefined; }
        if (lostCancel && msg.type === 'arca.transfer.cancel') return undefined;
        return request(external, msg, { id: targetId });
      },
    },
  };
  const loadWorker = async () => {
    const ctx = context(chrome);
    vm.runInContext(transfer, ctx);
    vm.runInContext(await read('features/arca/block-store.js'), ctx);
    vm.runInContext((await read('features/arca/background.mjs')).replace(/^import .*;\r?\n/gm, ''), ctx);
  };
  await loadWorker();
  const popup = { id: targetId, url: chrome.runtime.getURL('popup.html') };
  const send = (msg, sender = popup) => request(handler, msg, sender);
  return { from, to, send, popup, scripts, external, original, write, loadWorker };
}
test('successful two-extension handoff keeps originals, saves backup, then stops Dev', async () => {
  const s = await system();
  const result = await s.send({ type: 'arca.feature.enable' });
  assert.equal(result.ok, true);
  assert.equal(s.to.data.blocklist.arca.a.hideAll, true);
  assert.ok(s.to.data.blocklist.youtube.x);
  assert.equal(s.to.data.secret, undefined);
  assert.equal(s.to.data.arcaMigrationBackup.data, undefined);
  assert.equal(s.from.data.secret, 'keep private');
  assert.equal(s.from.data.arcaHandoff.status, 'committed');
  assert.equal(s.to.data.arcaFeature.enabled, true);
  assert.equal(s.scripts.length, 1);
  const denied = await request(s.external, { type: 'arca.transfer.prepare' }, { id: 'untrusted' });
  assert.equal(denied.ok, false);
});
for (const failure of ['failCommit', 'failEnable', 'failRegister']) test(`${failure}: source resumes, source records remain intact`, async () => {
  const s = await system({ [failure]: true });
  const result = await s.send({ type: 'arca.feature.enable' });
  assert.equal(result.ok, false);
  assert.equal(s.to.data.arcaFeature.enabled, false);
  assert.equal(s.from.data.arcaHandoff, undefined);
  assert.deepEqual(s.from.data.blocklist, s.original.blocklist);
  assert.equal(s.scripts.length, 0);
});
test('toggle does not reimport removed users or removed channel rules', async () => {
  const s = await system();
  assert.equal((await s.send({ type: 'arca.feature.enable' })).ok, true);
  s.to.data.blocklist.arca = {};
  s.to.data.karmoSettings.arca.autoBlockChannels = [];
  await s.send({ type: 'arca.feature.disable' });
  await s.send({ type: 'arca.feature.enable' });
  assert.deepEqual(s.to.data.blocklist.arca, {});
  assert.deepEqual(s.to.data.karmoSettings.arca.autoBlockChannels, []);
});
test('lost commit response and lost cancellation retain the recovery journal', async () => {
  const s = await system({ lostCommit: true, lostCancel: true });
  const result = await s.send({ type: 'arca.feature.enable' });
  assert.equal(result.ok, false);
  assert.equal(s.from.data.arcaHandoff.status, 'committed');
  assert.equal(s.to.data.arcaFeature.initializing, true);
  assert.ok(s.to.data.arcaMigrationJournal);
});
test('worker restart finishes a committed handoff with a persistent rollback journal', async () => {
  const s = await system();
  const prepared = await request(s.external, { type: 'arca.transfer.prepare' }, { id: s.popup.id });
  await request(s.external, { type: 'arca.transfer.commit', token: prepared.token }, { id: s.popup.id });
  s.to.data.arcaFeature = { enabled: false, initializing: true };
  s.to.data.arcaMigrationJournal = { before: {}, added: ['blocklist', 'karmoSettings', 'karmoVisited:c:1'] };
  await s.loadWorker();
  await s.send({ type: 'arca.feature.status' });
  assert.equal(s.to.data.arcaFeature.enabled, true);
  assert.equal(s.to.data.blocklist.arca.a.hideAll, true);
  assert.equal(s.to.data.arcaMigrationJournal, undefined);
});
test('Dev content writes and prepare share one queue, pending writes do not mutate snapshots', async () => {
  const s = await system();
  const sender = { id: 'lojdjbbekohhajlefkklkfoddldpheom' };
  await request(s.write, { type: 'arca.local.write', method: 'set', value: { 'karmoVisited:c:2': 200, secret: 'leak' } }, sender);
  const prepared = await request(s.external, { type: 'arca.transfer.prepare' }, { id: s.popup.id });
  assert.equal(prepared.data['karmoVisited:c:2'], 200);
  assert.equal(s.from.data.secret, 'keep private');
  assert.equal((await request(s.write, { type: 'arca.local.write', method: 'set', value: { 'karmoVisited:c:2': 300 } }, sender)).pending, true);
  assert.equal(s.from.data['karmoVisited:c:2'], 200);
});
test('without Dev activation starts empty; webpage cannot toggle ownership', async () => {
  const s = await system({ source: false });
  assert.equal((await s.send({ type: 'arca.feature.enable' }, { id: s.popup.id, url: 'https://arca.live/b/test' })).ok, false);
  assert.equal((await s.send({ type: 'arca.feature.enable' })).ok, true);
  assert.equal(s.to.data.arcaFeature.migrated, false);
  assert.equal((await s.send({ type: 'arca.feature.disable' })).ok, true);
  assert.equal(s.scripts.length, 0);
});
