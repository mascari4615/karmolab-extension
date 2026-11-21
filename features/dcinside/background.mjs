const id = 'karmolab-dcinside';
const matches = ['https://gall.dcinside.com/*', 'https://m.dcinside.com/*'];
const permission = { origins: matches };
const files = ['features/keyword-core.js', 'features/dcinside/block.js'];
const enabled = async () => (await chrome.storage.local.get('dcinsideEnabled')).dcinsideEnabled === true;
let tail = Promise.resolve();

async function register(active) {
  const found = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (active && !found.length) {
    await chrome.scripting.registerContentScripts([{ id, matches, js: files, css: ['features/dcinside/block.css'], runAt: 'document_idle' }]);
  } else if (!active && found.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  }
}

function serial(action) {
  const result = tail.then(action);
  tail = result.catch(() => {});
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith('dcinside.')) return false;
  const popup = sender.url === chrome.runtime.getURL('popup.html') || sender.url?.startsWith(chrome.runtime.getURL('popup.html#'));
  const page = matches.some(origin => sender.url?.startsWith(origin.slice(0, -1)));
  serial(async () => {
    const hasPermission = await chrome.permissions.contains(permission);
    if (message.type === 'dcinside.status' && popup) return { enabled: await enabled() && hasPermission };
    if (message.type === 'dcinside.toggle' && popup) {
      const active = message.enabled === true;
      const previous = await enabled();
      if (active && !hasPermission) throw Error('Site access is required.');
      await chrome.storage.local.set({ dcinsideEnabled: active });
      try { await register(active); }
      catch (error) {
        await chrome.storage.local.set({ dcinsideEnabled: previous });
        throw error;
      }
      return { enabled: active };
    }
    if (message.type === 'dcinside.running' && page) return { enabled: await enabled() && hasPermission };
    if ((message.type === 'dcinside.block' && page && hasPermission && await enabled()) ||
        (message.type === 'dcinside.remove' && popup)) {
      if (typeof message.key !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(message.key)) throw Error('Invalid account.');
      const op = message.type === 'dcinside.block' ? 'block' : 'remove';
      return globalThis.KarmoBlockStore.apply({ site: 'dcinside', op, key: message.key, name: String(message.name || message.key).slice(0, 100) });
    }
    throw Error('Unsupported DC Inside request.');
  }).then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
  return true;
});

const recover = () => serial(async () => {
  const active = await enabled();
  const allowed = await chrome.permissions.contains(permission);
  if (active && !allowed) await chrome.storage.local.set({ dcinsideEnabled: false });
  await register(active && allowed);
}).catch(console.error);
chrome.runtime.onStartup.addListener(recover);
chrome.runtime.onInstalled.addListener(recover);
chrome.permissions.onRemoved.addListener(recover);
recover();
