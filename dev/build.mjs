export function runtimeFiles(manifest) {
  return [...new Set([
    'manifest.json', 'dev/reload-worker.mjs', 'dev/build.mjs', 'popup.html', 'popup.js',
    'features/settings-navigation.js', 'features/settings-shell.css', 'features/popup-navigation.js', 'features/youtube-settings.html', 'features/youtube-panel.js', 'features/panel-background.mjs', 'features/panel-review-client.js', 'features/arca/options-navigation.js', 'features/arca/options.css',
    'features/base64-core.js', 'features/base64-links.js', 'features/base64-links.css',
    'background.mjs', 'features/shorts-playback-background.mjs', 'features/volume-background.mjs', 'features/volume-core.mjs', 'features/volume-offscreen.html', 'features/volume-offscreen.mjs', 'features/volume-page.js', 'features/volume-popup.mjs',
    'features/dark-mode-background.mjs', 'features/dark-mode-popup.mjs', 'features/dark-mode-page.js', 'features/dark-mode-engine.js',
    ...['background.mjs', 'popup.mjs', 'gallery.js', 'block.js', 'block.css'].map(file => `features/dcinside/${file}`),
    'features/keyword-background.mjs', 'features/keyword-sync.mjs', 'features/keyword-popup.mjs',
    ...['background.mjs', 'popup.mjs', 'data.js', 'feed-api.js', 'entry.js', 'block-store.js', 'block-defaults.js', 'block-toast.js', 'block-core.js', 'arca-profile.js', 'arca-auto-block.js', 'arca-insight.js', 'arca-block.js', 'arca-seen.js', 'arca-scrap.js', 'arca-liked-link.js', 'arca-liked.html', 'arca-liked.js', 'arca-liked.css', 'options.html', 'options.js', 'vendor/article-list.js', 'vendor/article-list.css'].map(file => `features/arca/${file}`),
    '_locales/ko/messages.json', '_locales/en/messages.json',
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap(item => [...(item.js || []), ...(item.css || [])]),
  ])].sort();
}

export async function buildDigest(manifest, read, digest) {
  const entries = await Promise.all(runtimeFiles(manifest).map(async file => [file, await digest(await read(file))]));
  return digest(new TextEncoder().encode(JSON.stringify(entries)));
}

export function storeManifest(source) {
  const manifest = structuredClone(source);
  manifest.background = { service_worker: 'background.mjs', type: 'module' };
  manifest.permissions = manifest.permissions.filter(value => value !== 'alarms');
  manifest.host_permissions = manifest.host_permissions.filter(value => value !== 'http://127.0.0.1/*');
  return manifest;
}
