import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(process.env.SHORTS_COUNT_SOURCE || new URL('../features/shorts-count.js', import.meta.url), 'utf8');
const messages = JSON.parse(readFileSync(new URL('../_locales/ko/messages.json', import.meta.url), 'utf8'));
const ID = 'abcdefghijk', OTHER = 'lmnopqrstuv';
function hub(values = {}) { return { values, listeners: [], key: 0, fail: false }; }
function fixture(store = hub()) {
  const f = { ms: 0, date: new Date(2026, 9, 15, 12).getTime(), hidden: false, offscreen: false, ad: false, blocked: false, domId: ID };
  const video = { paused: false, ended: false, seeking: false, readyState: 4, currentTime: 0, playbackRate: 1 };
  const location = { pathname: '/shorts/' + ID };
  const player = {
    closest: selector => selector === '.kl-block-playback' ? (f.blocked ? {} : null) : { querySelectorAll: () => [{ getAttribute: () => '/shorts/' + f.domId }] },
    getBoundingClientRect: () => ({ left: 300, top: f.offscreen ? -1000 : 10, right: 660, bottom: f.offscreen ? -360 : 650, width: 360, height: 640 }),
    querySelector: selector => selector === 'video' ? video : f.ad ? {} : null,
  };
  const emit = changes => store.listeners.forEach(listener => listener(changes, 'local'));
  const change = values => { Object.assign(store.values, values); emit(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]))); };
  const context = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [f.date])); } },
    Intl, navigator: { language: 'ko' }, location, innerWidth: 1000, innerHeight: 800,
    performance: { now: () => f.ms }, crypto: { randomUUID: () => 'visit-' + ++store.key },
    setInterval: fn => { f.tick = fn; },
    document: { documentElement: { lang: 'ko' }, get visibilityState() { return f.hidden ? 'hidden' : 'visible'; }, querySelectorAll: () => [player] },
    chrome: {
      i18n: { getMessage: (key, args) => messages[key].message.replace(/\$([A-Z]+)\$/g, (_, placeholder) => {
        const value = messages[key].placeholders[placeholder.toLowerCase()].content;
        return Array.isArray(args) ? args[Number(value.slice(1)) - 1] : args;
      }) },
      storage: {
        onChanged: { addListener: fn => store.listeners.push(fn) },
        local: {
          get: async () => { if (store.failRead) throw Error('read failed'); return { ...store.values }; },
          set: async values => { if (store.fail) throw Error('save failed'); change(values); },
          remove: async keys => { for (const key of keys) delete store.values[key]; emit(Object.fromEntries(keys.map(key => [key, {}]))); },
        },
      },
    },
  };
  vm.runInNewContext(source, context);
  f.ready = () => new Promise(resolve => setImmediate(resolve));
  f.step = async (ms = 250, advance = true) => { f.ms += ms; if (advance) video.currentTime += ms / 1000; f.tick(); await f.ready(); };
  f.watch = async () => { for (let i = 0; i < 10; i++) await f.step(); };
  f.navigate = id => { location.pathname = id ? '/shorts/' + id : '/feed/subscriptions'; f.domId = id; video.currentTime = 0; };
  f.text = () => context.KarmoShortsCount.text();
  return Object.assign(f, { store, video, change, location });
}

test('two seconds of playback, unique daily videos and repeated visits counted separately', async () => {
  const f = fixture(); await f.ready();
  for (let i = 0; i < 8; i++) await f.step();
  assert.equal(f.text(), '오늘 0개 / 0회');
  await f.step(); assert.equal(f.text(), '오늘 1개 / 1회');
  await f.watch(); assert.equal(f.text(), '오늘 1개 / 1회');
  f.video.currentTime = 0; await f.watch(); assert.equal(f.text(), '오늘 1개 / 1회', 'automatic loop is not a new visit');
  f.navigate(OTHER); await f.watch(); assert.equal(f.text(), '오늘 2개 / 2회');
  f.navigate(ID); await f.watch(); assert.equal(f.text(), '오늘 2개 / 3회');
});
test('paused, hidden, stalled, offscreen, blocked, ad and mismatched transition do not count', async () => {
  for (const flag of ['paused', 'hidden', 'offscreen', 'blocked', 'ad', 'mismatch', 'stalled', 'seeking']) {
    const f = fixture(); await f.ready();
    if (flag === 'paused' || flag === 'seeking') f.video[flag] = true;
    else if (flag === 'mismatch') f.domId = OTHER;
    else f[flag] = true;
    for (let i = 0; i < 16; i++) await f.step(250, flag !== 'stalled');
    assert.equal(f.text(), '오늘 0개 / 0회', flag);
  }
});
test('settings switch display without discarding either metric; collection can pause', async () => {
  const f = fixture(); await f.ready(); await f.watch();
  f.change({ shortsCountMode: 'unique' }); assert.equal(f.text(), '오늘 1개');
  f.change({ shortsCountMode: 'views' }); assert.equal(f.text(), '오늘 1회');
  f.change({ shortsCount: false }); f.navigate(OTHER); await f.watch(); assert.equal(f.text(), '');
  f.change({ shortsCount: true, shortsCountMode: 'both' }); await f.watch(); assert.equal(f.text(), '오늘 2개 / 2회');
});
test('local midnight resets, deletes previous-day visits and qualifies current playback again', async () => {
  const f = fixture(); await f.ready(); await f.watch();
  f.date = new Date(2026, 9, 16, 0, 0, 1).getTime(); await f.step();
  assert.equal(f.text(), '오늘 0개 / 0회'); await f.watch(); assert.equal(f.text(), '오늘 1개 / 1회');
  assert.ok(Object.keys(f.store.values).filter(key => key.startsWith('shortsDayView:')).every(key => key.includes('2026-10-16')));
});
test('two tabs append independent visits without lost updates; reload preserves both metrics', async () => {
  const store = hub(), a = fixture(store), b = fixture(store);
  await Promise.all([a.ready(), b.ready()]);
  for (let i = 0; i < 10; i++) await Promise.all([a.step(), b.step()]);
  assert.equal(a.text(), '오늘 1개 / 2회'); assert.equal(b.text(), a.text());
  const reloaded = fixture(store); await reloaded.ready(); assert.equal(reloaded.text(), a.text());
});
test('storage failures are visible and never presented as a successful increment', async () => {
  const f = fixture(); await f.ready(); f.store.fail = true; await f.watch();
  assert.equal(f.text(), messages.shortsCountError.message);
  assert.equal(Object.keys(f.store.values).length, 0);
  const broken = fixture({ ...hub(), failRead: true }); await broken.ready(); await broken.watch();
  assert.equal(broken.text(), messages.shortsCountError.message);
});
