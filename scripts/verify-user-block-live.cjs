const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdtempSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.VERIFY_OUTPUT || path.join(root, 'dist', 'verify-user-block-live');
(async () => {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'kl-block-'));
  mkdirSync(output, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    viewport: { width: 1440, height: 1000 }, locale: 'ko-KR',
  });
  try {
    const page = context.pages()[0];
    await page.goto('https://www.youtube.com/watch?v=NiCgcUTL9_Q', { waitUntil: 'domcontentloaded' });
    await page.locator('#comments').scrollIntoViewIfNeeded();
    const button = page.locator('ytd-comment-view-model .kl-block-button').first();
    await button.waitFor({ timeout: 45000 });
    const author = await button.getAttribute('aria-label');
    const comment = page.locator('ytd-comment-view-model').filter({ has: button });
    await page.screenshot({ path: path.join(output, 'comment-before.png') });
    page.on('dialog', dialog => dialog.accept());
    await button.click();
    await page.waitForFunction(() => document.querySelector('.kl-block-hidden'));
    assert.equal(await comment.isVisible(), false);
    await page.screenshot({ path: path.join(output, 'comment-blocked.png') });
    // Read the extension's actual storage through its isolated execution context.
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
    await cdp.send('Runtime.enable');
    let extensionId;
    for (const world of worlds) {
      const result = await cdp.send('Runtime.evaluate', { expression: 'globalThis.chrome?.runtime?.id', contextId: world.id, returnByValue: true });
      if (result.result.value) extensionId = result.result.value;
    }
    assert.ok(extensionId, 'real extension isolated world');
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.locator('#blockedList button').waitFor();
    await page.screenshot({ path: path.join(output, 'popup.png') });
    console.log(JSON.stringify({ author, extensionId, blockedUsers: await page.locator('#blockedList li').count() }));
    await page.goto('https://www.youtube.com/results?search_query=veritasium', { waitUntil: 'domcontentloaded' });
    await page.locator('ytd-video-renderer').first().waitFor({ state: 'attached' });
    if (author.toLowerCase().includes('veritasium')) {
      await page.waitForFunction(() => [...document.querySelectorAll('ytd-video-renderer')].some(el => el.classList.contains('kl-block-hidden')));
      console.log('PASS: real comment click -> real storage -> search videos hidden');
    }
    await page.screenshot({ path: path.join(output, 'search-blocked.png') });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.locator('#blockedList button').click();
    await page.waitForFunction(() => document.querySelectorAll('#blockedList li').length === 0);
    console.log('PASS: real extension popup unblock');
    await page.goto('https://www.youtube.com/results?search_query=veritasium+shorts', { waitUntil: 'domcontentloaded' });
    const shortLink = page.locator('a[href^="/shorts/"]').first();
    await shortLink.waitFor({ state: 'attached' });
    const shortHref = await shortLink.getAttribute('href');
    await page.goto('https://www.youtube.com' + shortHref, { waitUntil: 'domcontentloaded' });
    const shortButton = page.locator('ytd-reel-video-renderer .kl-block-button').filter({ visible: true }).first();
    await shortButton.waitFor();
    await shortButton.click();
    await page.locator('ytd-reel-video-renderer .kl-block-notice').filter({ visible: true }).first().waitFor();
    assert.equal(await page.locator('ytd-reel-video-renderer.kl-block-playback video').first().evaluate(video => video.paused), true);
    await page.screenshot({ path: path.join(output, 'shorts-blocked.png') });
    console.log('PASS: real Shorts channel block -> cover and paused video');
  } catch (error) {
    console.error('LIVE FAILURE:', error);
    await context.pages()[0]?.screenshot({ path: path.join(output, 'failure.png') });
    throw error;
  } finally {
    await context.close();
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    catch { console.error('Temporary browser profile retained: ' + profile); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
