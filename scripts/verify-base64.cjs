const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { createHash, generateKeyPairSync } = require('node:crypto');
const { createServer } = require('node:http');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.VERIFY_OUTPUT || path.join(root, 'dist', 'verify-base64');
const token = Buffer.from('https://example.com/path?q=한글').toString('base64');
const text = `첫 링크 ${token} 두 번째 ${Buffer.from('https://example.org/b').toString('base64url')}`;
const fixture = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Base64 링크 시험</title><style>
body { margin:24px; max-width:680px; font:16px/1.8 system-ui; color:#222; background:#fff;overflow-wrap:anywhere } h1{font-size:24px} pre{overflow-x:auto} textarea{width:90%;height:70px}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}
</style><h1>본문과 댓글의 Base64 링크</h1><p id="initial">${text}</p><p id="plain">일반 텍스트는 그대로</p><div id="dynamic"></div>
<h2>입력과 코드 영역</h2><textarea>${token}</textarea><div contenteditable="true">${token}</div><pre>${token}</pre><a id="existing" href="#">${token}</a><p id="unsafe">${Buffer.from('javascript:alert(1)').toString('base64')}</p></html>`;

(async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kl-base64-'));
  const extension = path.join(tmp, 'extension');
  mkdirSync(extension);
  mkdirSync(output, { recursive: true });
  for (const file of ['features', '_locales', 'icons', 'popup.html', 'popup.js']) cpSync(path.join(root, file), path.join(extension, file), { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  // Opening popup.html as a tab does not simulate toolbar-click activeTab access.
  // Grant only the local fixture host in this disposable test installation.
  manifest.host_permissions.push('http://127.0.0.1/*');
  const publicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' });
  manifest.key = publicKey.toString('base64');
  const id = createHash('sha256').update(publicKey).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
  writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
      channel: 'chromium', headless: true, locale: 'ko-KR',
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      viewport: { width: 1440, height: 900 },
      hasTouch: process.env.VERIFY_TOUCH === '1',
    });
    const page = context.pages()[0];
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('.kl-base64-link').count(), 0, 'off until the site is enabled');
    const popup = await context.newPage();
    popup.setDefaultTimeout(15000);
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await page.bringToFront();
    await popup.reload();
    await popup.locator('#base64Site:not([disabled])').waitFor();
    await popup.bringToFront();
    await popup.locator('#base64Site').click();
    await page.bringToFront();
    await page.locator('#initial .kl-base64-link').first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#initial .kl-base64-link').count(), 2);
    assert.equal(await page.locator('#initial .kl-base64-link').first().getAttribute('href'), 'https://example.com/path?q=%ED%95%9C%EA%B8%80');
    assert.ok((await page.locator('#initial').textContent()).includes(token));
    const source = page.locator('#initial .kl-base64-original').first();
    const reveal = page.locator('#initial .kl-base64-reveal').first();
    assert.equal(await source.isVisible(), false, 'source collapsed by default');
    assert.equal(await page.locator('#initial .kl-base64-link').first().innerText(), 'example.com');
    await page.locator('#initial .kl-base64-link').first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await reveal.evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await source.isVisible(), true);
    assert.equal(await source.textContent(), token);
    await page.screenshot({ path: path.join(output, 'source-expanded.png') });
    await page.keyboard.press('Space');
    assert.equal(await source.isVisible(), false);
    if (process.env.VERIFY_TOUCH === '1') {
      assert.equal(await reveal.evaluate(el => el.getBoundingClientRect().height), 40);
      await reveal.tap();
      assert.equal(await source.isVisible(), true);
      await reveal.tap();
      assert.equal(await source.isVisible(), false);
    }
    for (const selector of ['textarea', '[contenteditable]', 'pre', '#existing', '#unsafe']) assert.equal(await page.locator(selector + ' .kl-base64-link').count(), 0);
    await page.evaluate(token => { const p = document.createElement('p'); p.textContent = token; document.querySelector('#dynamic').append(p); }, token);
    await page.locator('#dynamic .kl-base64-link').waitFor();
    await page.locator('#dynamic p').evaluate((p, token) => { p.textContent = token; }, token);
    await page.locator('#dynamic .kl-base64-link').waitFor();
    assert.equal(await page.locator('#dynamic .kl-base64-link').count(), 1, 'no duplicate on rerender');
    let destinationRequests = 0;
    page.on('request', request => { if (request.url().startsWith('https://example.')) destinationRequests++; });
    await page.reload();
    await page.locator('#initial .kl-base64-link').first().waitFor();
    assert.equal(destinationRequests, 0, 'no prefetch');
    await page.locator('#initial .kl-base64-link').first().focus();
    assert.equal(await page.evaluate(() => document.activeElement.className), 'kl-base64-link');
    assert.equal(await page.locator('.kl-base64-link').first().getAttribute('rel'), 'noopener noreferrer');
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'narrow-dark.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'small-dark.png') });
    await page.bringToFront();
    await popup.reload();
    await popup.locator('#base64Site:not([disabled])').waitFor();
    await popup.screenshot({ path: path.join(output, 'popup.png') });
    await popup.bringToFront();
    await popup.locator('#base64Site').click();
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelectorAll('.kl-base64-entry').length === 0);
    assert.equal(await page.locator('#initial').textContent(), text);
    await page.reload();
    assert.equal(await page.locator('.kl-base64-link').count(), 0);
    assert.deepEqual(errors, []);
    const result = { status: 'PASS', extension: manifest.version, fixtureHostPreGranted: true, nativePermissionPrompt: 'not tested', initialLinks: 2, dynamic: true, cleanup: true, originalText: true, excludedEditors: true, noPrefetch: true, keyboard: true, sourceDisclosure: true, touch: process.env.VERIFY_TOUCH === '1', viewports: [1440, 390, 320] };
    writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(result);
  } finally {
    if (context) await context.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(tmp, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
