import { createSyncSnapshot } from './sync-snapshot.mjs';

const enabledKey = 'blockSyncEnabled';
const baselineKey = 'blockSyncBaseline';
const errorKey = 'blockSyncError';
const youtubeBlock = 'blockedChannel:';
const youtubeAllow = 'keywordAutoBlockAllow:';
const mapSites = { arca: 'arca', dc: 'dcinside' };
const setFields = {
  arcaAllow: ['arca', 'autoAllowKeys'],
  dcAllow: ['dcinside', 'autoAllowKeys'],
  dcGallery: ['dcinside', 'blockedChannels']
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const youtubeKey = key => key.startsWith(youtubeBlock) || key.startsWith(youtubeAllow);
const knownKey = key => youtubeKey(key) || /^(arca|dc|arcaAllow|dcAllow|dcGallery):.+$/.test(key);

function extract(data) {
  const records = new Map(Object.entries(data).filter(([key, value]) => youtubeKey(key) && value));
  for (const [prefix, site] of Object.entries(mapSites)) {
    for (const [id, record] of Object.entries(data.blocklist?.[site] || {})) {
      if (!record || typeof record !== 'object') continue;
      const { autoChannel, autoPrevious, ...entry } = record;
      records.set(prefix + ':' + id, site === 'arca' ? entry : record);
    }
  }
  for (const [prefix, [site, field]] of Object.entries(setFields)) {
    for (const id of data.karmoSettings?.[site]?.[field] || []) records.set(prefix + ':' + id, true);
  }
  return records;
}

async function encode(records) {
  const stream = new Blob([JSON.stringify([...records])]).stream().pipeThrough(new CompressionStream('gzip'));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  const rows = [];
  for (let offset = 0; offset < data.length; offset += 5400) {
    rows.push([String(rows.length), btoa(String.fromCharCode(...data.subarray(offset, offset + 5400)))]);
  }
  return rows;
}

async function decode(rows) {
  const parts = rows.map(([, chunk]) => Uint8Array.from(atob(chunk), char => char.charCodeAt(0)));
  const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'));
  const records = await new Response(stream).json();
  return new Map(records.filter(([key]) => typeof key === 'string' && knownKey(key)));
}

function reconcile(local, cloud, base) {
  const merged = new Map(cloud);
  for (const key of new Set([...local.keys(), ...base.keys()])) {
    const value = local.get(key);
    if (same(value, base.get(key))) continue;
    if (value === undefined) merged.delete(key);
    else merged.set(key, value);
  }
  return new Map([...merged].sort(([a], [b]) => a < b ? -1 : Number(a > b)));
}

function localChanges(data, observed, desired) {
  const latest = extract(data);
  const patch = {};
  const remove = [];
  const blockMaps = new Map();
  for (const key of new Set([...observed.keys(), ...desired.keys()])) {
    const before = observed.get(key);
    const after = desired.get(key);
    if (same(before, after) || !same(before, latest.get(key))) continue;
    if (youtubeKey(key)) {
      if (after === undefined) remove.push(key);
      else patch[key] = after;
      continue;
    }
    const separator = key.indexOf(':');
    const prefix = key.slice(0, separator);
    const id = key.slice(separator + 1);
    if (Object.hasOwn(mapSites, prefix)) {
      const site = mapSites[prefix];
      if (!blockMaps.has(site)) blockMaps.set(site, new Map(Object.entries(data.blocklist?.[site] || {})));
      const entries = blockMaps.get(site);
      if (after === undefined) entries.delete(id);
      else entries.set(id, after);
    } else if (Object.hasOwn(setFields, prefix)) {
      const [site, field] = setFields[prefix];
      patch.karmoSettings ||= { ...data.karmoSettings };
      const entries = new Set(patch.karmoSettings[site]?.[field] || []);
      if (after === undefined) entries.delete(id);
      else entries.add(id);
      patch.karmoSettings[site] = { ...patch.karmoSettings[site], [field]: [...entries] };
    }
  }
  if (blockMaps.size) {
    patch.blocklist = { ...data.blocklist };
    for (const [site, entries] of blockMaps) patch.blocklist[site] = Object.fromEntries(entries);
  }
  return { patch, remove };
}

export function createBlockSync(storage) {
  const snapshot = createSyncSnapshot(storage.sync, 'karmolabBlocks');
  async function run(enable = false, retry = true) {
    const initial = await storage.local.get(null);
    if (!enable && (!initial.keywordSyncEnabled || !initial[enabledKey])) return;
    const local = extract(initial);
    const remote = await snapshot.remote();
    const cloud = remote ? await decode(remote.rows) : new Map();
    const base = remote ? new Map(initial[baselineKey] || []) : new Map();
    const merged = reconcile(local, cloud, base);
    if (!same([...merged], [...cloud])) {
      try { await snapshot.publish(await encode(merged), remote); }
      catch (error) {
        if (retry && error.code === 'snapshot-changed') return run(enable, false);
        throw error;
      }
    }
    const { patch, remove } = localChanges(await storage.local.get(null), local, merged);
    if (Object.keys(patch).length) await storage.local.set(patch);
    if (remove.length) await storage.local.remove(remove);
    const state = {};
    if (enable && !initial[enabledKey]) state[enabledKey] = true;
    if (!same(initial[baselineKey], [...merged])) state[baselineKey] = [...merged];
    if (initial[errorKey]) state[errorKey] = '';
    if (Object.keys(state).length) await storage.local.set(state);
  }

  return {
    run,
    disable: () => storage.local.set({ [enabledKey]: false, [errorKey]: '' }),
    remoteChanged: snapshot.changed,
    localChanged: changes => Object.keys(changes).some(key => youtubeKey(key) || key === 'blocklist' || key === 'karmoSettings')
  };
}
