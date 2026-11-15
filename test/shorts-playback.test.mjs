import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeShortsPlayback, registerShortsPlayback } from '../features/shorts-playback-background.mjs';

const first = 'aaaaaaaaaaa', next = 'bbbbbbbbbbb';
function fixture({ aligned = false, blocked = true, playerId = first, path = first, target = next } = {}) {
  const calls = [];
  const shorts = { index: 0, currentPlayerIndex: aligned ? 0 : 1, currentEndpoint: { reelWatchEndpoint: { videoId: first } }, shortsProcessedSequence: [null, { command: { reelWatchEndpoint: { videoId: target } } }], loadVideo: index => calls.push(['load', index]) };
  const root = { classList: { contains: () => blocked } };
  const player = { closest: () => root, getVideoData: () => ({ video_id: playerId }), playVideo: () => calls.push(['play']) };
  let now = 0;
  const context = vm.createContext({
    location: { origin: 'https://www.youtube.com', pathname: '/shorts/' + path },
    document: { visibilityState: 'visible', querySelector: selector => selector === 'ytd-shorts' ? shorts : selector === '#shorts-player' ? player : blocked ? root : null },
    performance: { now: () => now += 1000 }, requestAnimationFrame: callback => callback(),
  });
  return { calls, shorts, context, run: action => vm.runInContext('(' + nativeShortsPlayback.toString() + ')(' + JSON.stringify(action) + ',' + JSON.stringify(first) + ')', context) };
}
test('recover only the stale native player index and preserve the actual sequence', async () => {
  const f = fixture();
  const result = await f.run('recover');
  assert.equal(result.ok, true); assert.equal(result.nextId, next);
  assert.equal(f.shorts.currentPlayerIndex, 0); assert.deepEqual(f.calls, [['load', 1]]);
});
test('aligned, allowed, changed URL and invalid next endpoint never trigger recovery', async () => {
  for (const options of [{ aligned: true }, { blocked: false }, { path: next }, { target: 'invalid' }, { target: first }]) {
    const f = fixture(options);
    assert.equal((await f.run('recover')).ok, false); assert.deepEqual(f.calls, []);
  }
});
test('resume only the verified current player after the cover is removed', async () => {
  const f = fixture({ blocked: false });
  assert.equal((await f.run('resume')).ok, true); assert.deepEqual(f.calls, [['play']]);
});
test('blocked, changed, hidden and mismatched players never resume', async () => {
  for (const options of [{ blocked: true }, { blocked: false, path: next }, { blocked: false, playerId: next }, { blocked: false, hidden: true }]) {
    const f = fixture(options);
    if (options.hidden) f.context.document.visibilityState = 'hidden';
    assert.equal((await f.run('resume')).ok, false); assert.deepEqual(f.calls, []);
  }
});
test('background scopes native execution to its own top-level YouTube sender and rechecks tab URL', async () => {
  let listener;
  const calls = [];
  let url = 'https://www.youtube.com/shorts/' + first;
  const api = { runtime: { id: 'self', onMessage: { addListener: fn => listener = fn } }, tabs: { get: async id => ({ id, url }) }, scripting: { executeScript: async options => { calls.push(options); return [{ result: { ok: true } }]; } } };
  registerShortsPlayback(api);
  const message = { type: 'shorts-playback-recover', videoId: first };
  const sender = { id: 'self', frameId: 0, tab: { id: 7 }, url };
  for (const invalid of [{ ...sender, id: 'other' }, { ...sender, frameId: 2 }, { ...sender, url: 'https://example.com/shorts/' + first }]) {
    assert.equal(listener(message, invalid, () => {}), undefined);
  }
  url = 'https://www.youtube.com/shorts/' + next;
  await new Promise(resolve => { assert.equal(listener(message, sender, result => { assert.equal(result.ok, false); resolve(); }), true); });
  assert.equal(calls.length, 0);
  url = sender.url;
  await new Promise(resolve => listener(message, sender, result => { assert.equal(result.ok, true); resolve(); }));
  assert.equal(calls.length, 1); assert.equal(calls[0].world, 'MAIN'); assert.equal(calls[0].target.tabId, 7);
  assert.deepEqual(calls[0].args, ['recover', first]);
  const spaSender = { ...sender, url: 'https://www.youtube.com/shorts/' + next };
  await new Promise(resolve => listener(message, spaSender, result => { assert.equal(result.ok, true); resolve(); }));
  assert.equal(calls.length, 2, 'sender document URL may precede the current SPA route');
});
