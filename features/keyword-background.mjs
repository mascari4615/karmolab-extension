import './density-core.js';
import './settings-backup.js';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['karmolab.keywords.ready', 'karmolab.keywords.save', 'karmolab.backup.restore'].includes(message?.type)) return false;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('features/youtube-settings.html')) return false;
  const store = globalThis.KarmoBlockStore;
  const ready = () => store.apply({ op: 'migrateKeywords' });
  const run = message.type === 'karmolab.backup.restore'
    ? ready().then(() => store.exclusive(() => globalThis.KarmoSettingsBackup.restore(message.backup, chrome.storage)))
    : message.type === 'karmolab.keywords.save'
      ? store.apply({ op: 'keywordReplace', words: message.words, autoWords: message.autoWords })
      : ready();
  run.then(() => respond({ ok: true }), error => respond({ ok: false, partial: error.partial }));
  return true;
});

