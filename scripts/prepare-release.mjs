import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function versionParts(version) {
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(version)) throw new Error('Invalid extension version');
  const parts = version.split('.').map(Number);
  if (parts.some(value => value > 65535) || parts.every(value => value === 0)) throw new Error('Invalid extension version');
  return [...parts, ...Array(4 - parts.length).fill(0)];
}
export function isNewer(current, previous) {
  const a = versionParts(current), b = versionParts(previous);
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function main() {
  const { values } = parseArgs({ options: { base: { type: 'string' } } });
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  versionParts(manifest.version);
  const notes = readFileSync(`release-notes/${manifest.version}.txt`, 'utf8').trim();
  if (!notes || notes.length >= 2000) throw new Error('Release notes required, maximum 1999 characters');
  let release = false;
  if (values.base && !/^0+$/.test(values.base)) {
    if (!/^[\da-f]{40}$/i.test(values.base)) throw new Error('Base must be a full commit SHA');
    const before = JSON.parse(execFileSync('git', ['show', `${values.base}:manifest.json`], { encoding: 'utf8' }));
    const paths = execFileSync('git', ['diff', '--name-only', values.base, 'HEAD'], { encoding: 'utf8' }).split('\n');
    const runtimeChanged = paths.some(path => /^(manifest\.json|features\/|icons\/|_locales\/|popup\.)/.test(path));
    release = isNewer(manifest.version, before.version);
    if (manifest.version !== before.version && !release) throw new Error('Version must increase');
    if (runtimeChanged && !release) throw new Error('Runtime change requires a version bump');
  }
  execFileSync(process.execPath, ['--test'], { stdio: 'inherit' });
  for (const script of ['popup.js', ...manifest.content_scripts.flatMap(entry => entry.js || [])]) {
    execFileSync(process.execPath, ['--check', script], { stdio: 'inherit' });
  }
  execFileSync(process.execPath, ['pack.mjs'], { stdio: 'inherit' });
  const filename = `karmolab-${manifest.version}.zip`;
  const sha256 = createHash('sha256').update(readFileSync(`dist/${filename}`)).digest('hex');
  const output = { version: manifest.version, filename, sha256, release };
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(output).map(([key, value]) => `${key}=${value}\n`).join(''));
  console.log(JSON.stringify(output));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
