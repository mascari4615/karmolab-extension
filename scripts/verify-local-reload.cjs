const { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } = require('node:fs');
const { generateKeyPairSync, createHash } = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const root = path.resolve(__dirname, '..');
  const { reloadLocal } = await import(pathToFileURL(path.join(root, 'scripts/reload-local.mjs')).href);
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kl-reload-'));
  const extension = path.join(tmp, 'extension');
  const output = process.env.VERIFY_OUTPUT || path.join(root, 'dist/verify-local-reload');
  mkdirSync(extension); mkdirSync(output, { recursive: true });
  for (const file of ['features', 'dev', 'background.mjs', '_locales', 'icons', 'popup.html', 'popup.js', 'manifest.json']) cpSync(path.join(root, file), path.join(extension, file), { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' });
  manifest.key = key.toString('base64');
  const id = createHash('sha256').update(key).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
  writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const feature = path.join(extension, 'features/shorts-count.js');
  const original = readFileSync(feature, 'utf8');
  const setMarker = value => writeFileSync(feature, original + `\ndocument.documentElement.dataset.reloadProof = '${value}';\n`);
  setMarker('one');
  let context;
  const errors = [];
  try {
    const channel = process.env.VERIFY_BROWSER || 'msedge';
    context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), { channel, headless: false, ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const observe = worker => worker.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') errors.push(message.text()); });
    context.on('serviceworker', observe);
    context.serviceWorkers().forEach(observe);
    if (channel !== 'msedge') {
      const settings = await context.newPage();
      await settings.goto('chrome://extensions/');
      const developerMode = settings.locator('#devMode');
      await developerMode.waitFor();
      if (await developerMode.getAttribute('aria-pressed') === 'false') await developerMode.click();
      assert.equal(await developerMode.getAttribute('aria-pressed'), 'true');
      await settings.close();
    }
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local reload test</title><h1>KarmoLab local reload</h1>' }));
    const page = context.pages()[0];
    await page.goto('https://www.youtube.com/');
    await page.waitForFunction(() => document.documentElement.dataset.reloadProof === 'one');
    const results = [];
    for (const marker of ['two', 'three']) {
      setMarker(marker);
      const result = await reloadLocal({ root: extension, id });
      console.log(JSON.stringify({ marker, result }));
      await page.waitForFunction(value => document.documentElement.dataset.reloadProof === value, marker, { timeout: 15000 });
      assert.notEqual(result.beforeBoot, result.afterBoot);
      results.push({ marker, ...result });
    }
    assert.equal(manifest.version, '0.4.0');
    assert.equal(errors.length, 0, errors.join('\n'));
    writeFileSync(path.join(output, 'result.json'), JSON.stringify({ browser: channel, browserVersion: context.browser().version(), results, errors, version: manifest.version }, null, 2));
    await page.screenshot({ path: path.join(output, 'after-two-reloads.png') });
    console.log(JSON.stringify({ reloads: results.length, version: manifest.version, output }));
  } catch (error) {
    const preferences = {};
    for (const file of ['Preferences', 'Secure Preferences']) {
      try { preferences[file] = JSON.parse(readFileSync(path.join(tmp, 'profile/Default', file), 'utf8')).extensions; } catch {}
    }
    const probe = await context.newPage();
    let popup;
    try {
      await probe.goto(`chrome-extension://${id}/popup.html`, { timeout: 5000 });
      popup = await probe.evaluate(() => ({ manifest: chrome.runtime.getManifest(), local: null }));
    } catch (failure) { popup = { error: failure.message }; }
    const workers = await Promise.all((context?.serviceWorkers() || []).map(async worker => {
      try { return await worker.evaluate(async () => ({ url: location.href, alarms: await chrome.alarms.getAll(), self: await chrome.management.getSelf(), pending: await chrome.storage.local.get('karmolabLocalReloadPending') })); }
      catch (failure) { return { error: failure.message }; }
    }));
    writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, errors, workers, popup, preferences }, null, 2));
    console.error(JSON.stringify({ errors, workers, popup }));
    throw error;
  } finally {
    await context?.close();
    rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
