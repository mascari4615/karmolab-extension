(() => {
  const keywords = typeof module !== 'undefined' && module.exports ? require('./keyword-core.js') : globalThis.KarmoKeywords;
  const booleans = ['shortsDate', 'shortsCount', 'shortsWatchTime', 'userBlock', 'keywordEnabled', 'keywordComments', 'keywordVideos', 'keywordShorts', 'commentTranslate'];
  const settingKeys = [...booleans, 'shortsCountMode', 'keywordWords', 'commentDensity', 'homeDensity'];
  const format = 'karmolab-youtube-backup';
  const maxBytes = 1024 * 1024;
  const idValid = id => typeof id === 'string' && (/^UC[\w-]{22}$/.test(id) || /^@[^\s/#?<>"\u0000-\u001f\u007f]{1,100}$/u.test(id));
  function validate(input) {
    if (!input || input.format !== format || input.version !== 1 || !input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings) || !Array.isArray(input.blocks) || input.blocks.length > 5000) throw Error('Invalid backup format');
    const settings = {};
    for (const [key, value] of Object.entries(input.settings)) {
      if (!settingKeys.includes(key)) throw Error('Unknown setting');
      if (booleans.includes(key) && typeof value !== 'boolean') throw Error('Invalid boolean');
      if (key === 'shortsCountMode' && !['both', 'unique', 'views'].includes(value)) throw Error('Invalid display mode');
      if (key === 'commentDensity' && !['default', 'compact'].includes(value)) throw Error('Invalid comment density');
      if (key === 'homeDensity' && !['default', 'small', 'compact'].includes(value)) throw Error('Invalid home density');
      if (key === 'keywordWords') {
        if (!Array.isArray(value) || value.some(word => typeof word !== 'string' || /[\r\n]/.test(word))) throw Error('Invalid keywords');
        settings[key] = keywords.parse(value.join('\n'));
      } else settings[key] = value;
    }
    const seen = new Set();
    const blocks = input.blocks.map(record => {
      if (!record || !Array.isArray(record.ids) || !record.ids.length || record.ids.length > 20 || !record.ids.every(idValid)
        || !record.ids.some(id => record.key === 'blockedChannel:' + id) || seen.has(record.key)
        || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 500
        || !Number.isSafeInteger(record.created) || record.created < 0) throw Error('Invalid blocked user');
      seen.add(record.key);
      return { key: record.key, name: record.name, ids: [...new Set(record.ids)], created: record.created };
    });
    return { format, version: 1, settings, blocks };
  }
  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > maxBytes) throw Error('Backup exceeds 1 MiB');
    return validate(JSON.parse(text));
  }
  function create(local, sync) {
    const settings = {};
    for (const key of settingKeys) {
      const value = key === 'shortsDate' ? sync[key] : local[key];
      settings[key] = value === undefined ? (key === 'keywordWords' ? [] : key === 'shortsCountMode' ? 'both' : key.endsWith('Density') ? 'default' : true) : value;
    }
    const blocks = Object.entries(local).filter(([key]) => key.startsWith('blockedChannel:')).map(([key, record]) => ({ ...record, key }));
    const backup = { ...validate({ format, version: 1, settings, blocks }), exportedAt: new Date().toISOString() };
    parse(JSON.stringify(backup));
    return backup;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  async function rollback(area, before, patch) {
    const current = await area.get(Object.keys(patch));
    const restore = {}, remove = [];
    for (const key of Object.keys(patch)) {
      if (!same(current[key], patch[key])) continue;
      if (Object.hasOwn(before, key)) restore[key] = before[key]; else remove.push(key);
    }
    if (Object.keys(restore).length) await area.set(restore);
    if (remove.length) await area.remove(remove);
  }
  async function restore(input, storage) {
    const backup = validate(input);
    const [local, sync] = await Promise.all([storage.local.get(null), storage.sync.get(null)]);
    const localPatch = {}, syncPatch = {};
    for (const [key, value] of Object.entries(backup.settings)) (key === 'shortsDate' ? syncPatch : localPatch)[key] = value;
    for (const { key, ...record } of backup.blocks) {
      const existing = local[key];
      localPatch[key] = existing?.ids ? { ...existing, ids: [...new Set([...existing.ids, ...record.ids])] } : record;
      if (localPatch[key].ids.length > 20) throw Error('Too many blocked-user aliases');
    }
    const attempts = [];
    try {
      for (const [area, before, patch] of [[storage.local, local, localPatch], [storage.sync, sync, syncPatch]]) {
        if (!Object.keys(patch).length) continue;
        attempts.push([area, before, patch]);
        await area.set(patch);
      }
    } catch (cause) {
      let partial = false;
      for (const args of attempts.reverse()) { try { await rollback(...args); } catch { partial = true; } }
      throw Object.assign(new Error('Could not restore backup'), { cause, partial });
    }
    return { settings: Object.keys(backup.settings).length, blocks: backup.blocks.length };
  }
  const api = { create, parse, restore, maxBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoSettingsBackup = api;
})();
