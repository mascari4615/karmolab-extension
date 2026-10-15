export function runtimeFiles(manifest) {
  return [...new Set([
    'manifest.json', 'dev/reload-worker.mjs', 'dev/build.mjs', 'popup.html', 'popup.js',
    'features/base64-core.js', 'features/base64-links.js', 'features/base64-links.css',
    'background.mjs', 'features/volume-background.mjs', 'features/volume-core.mjs', 'features/volume-offscreen.html', 'features/volume-offscreen.mjs', 'features/volume-page.js', 'features/volume-popup.mjs',
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
