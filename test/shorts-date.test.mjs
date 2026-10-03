import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(process.env.SHORTS_DATE_SOURCE || new URL('../features/shorts-date.js', import.meta.url), 'utf8');
const ID = 'abcdefghijk';
const OTHER = 'lmnopqrstuv';
const rect = (left = 1007, top = 64, width = 682, height = 1212) =>
  ({ left, top, width, height, right: left + width, bottom: top + height });

function fixture() {
  const state = { rect: rect(), id: ID, nodes: [], calls: 0 };
  const player = {
    getBoundingClientRect: () => state.rect,
    closest: () => ({ querySelectorAll: () => [{ getAttribute: () => `/shorts/${state.id}` }] }),
  };
  const card = { getBoundingClientRect: () => rect(240, 64, 2216) };
  const location = { pathname: `/shorts/${ID}` };
  const context = {
    location, innerWidth: 2552, innerHeight: 1308, navigator: { language: 'ko' },
    Intl, Date, setInterval: fn => { state.tick = fn; },
    fetch: async () => { state.calls++; return { ok: true, json: async () => ({ microformat: { playerMicroformatRenderer: { publishDate: '2026-09-30' } } }) }; },
    chrome: { storage: { sync: { get: (v, cb) => cb(v) }, onChanged: { addListener: fn => { state.change = fn; } } } },
    document: {
      scripts: [], documentElement: { lang: 'ko', appendChild: b => { b.isConnected = true; state.nodes.push(b); } },
      querySelectorAll: selector => selector.includes(',') ? [card, player] : [player],
      createElement: () => ({ dataset: {}, style: {}, hidden: true, textContent: '', get offsetWidth() { return this.hidden ? 0 : this.textContent.includes('(') ? 130 : 70; } }),
    },
  };
  vm.runInNewContext(source, context);
  state.context = context;
  state.location = location;
  state.step = async () => { state.tick(); await new Promise(resolve => setImmediate(resolve)); };
  state.ready = async () => { await state.step(); await state.step(); await state.step(); };
  state.badge = () => state.nodes[0];
  return state;
}

test('wide outer card cannot displace badge from actual player', async () => {
  const f = fixture(); await f.ready();
  assert.equal(f.badge().hidden, false);
  assert.equal(f.badge().style.left, '865px');
  assert.equal(f.badge().style.top, '76px');
});
test('scroll animation hides badge until player stops moving', async () => {
  const f = fixture(); await f.ready();
  for (const top of [-400, -150, 64]) { f.rect = rect(1007, top); await f.step(); assert.equal(f.badge().hidden, true); }
  await f.step(); assert.equal(f.badge().hidden, false); assert.equal(f.badge().style.top, '76px');
});
test('new URL must not display date beside previous video DOM', async () => {
  const f = fixture(); await f.ready(); f.location.pathname = `/shorts/${OTHER}`;
  await f.step(); await f.step(); assert.equal(f.badge().hidden, true);
  f.id = OTHER; await f.step(); assert.equal(f.badge().hidden, true);
  await f.step(); assert.equal(f.badge().hidden, false);
});
test('resize waits for stable geometry and retains narrow fallback', async () => {
  const f = fixture(); await f.ready(); f.rect = rect(50, 64, 360, 640);
  await f.step(); assert.equal(f.badge().hidden, true);
  await f.step(); assert.equal(f.badge().hidden, false); assert.equal(f.badge().style.left, '62px');
  assert.equal(f.badge().dataset.inside, '1'); assert.equal(f.badge().textContent.includes('('), false);
});
test('disconnected player hides instead of anchoring to outer card', async () => {
  const f = fixture(); await f.ready(); f.rect = rect(1007, -1500);
  await f.step(); assert.equal(f.badge().hidden, true);
});
test('settings and leaving shorts hide badge; one badge and one request per video', async () => {
  const f = fixture(); await f.ready(); await f.step();
  assert.equal(f.nodes.length, 1); assert.equal(f.calls, 1);
  f.change({ shortsDate: { newValue: false } }, 'sync'); await f.step(); assert.equal(f.badge().hidden, true);
  f.change({ shortsDate: { newValue: true } }, 'sync'); await f.ready(); assert.equal(f.badge().hidden, false);
  f.location.pathname = '/watch'; await f.step(); assert.equal(f.badge().hidden, true);
});
