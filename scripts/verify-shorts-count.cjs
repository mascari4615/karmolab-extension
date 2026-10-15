const { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { createHash, generateKeyPairSync } = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.VERIFY_OUTPUT || path.join(root, 'dist', 'verify-shorts-count');
const ID = 'abcdefghijk', OTHER = 'lmnopqrstuv';
const shorts = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>쇼츠 집계 시험</title><style>
body{margin:0;background:#121212;color:#eee;font:16px system-ui}h1{margin:24px;font-size:18px}#shorts-player{position:absolute;left:calc(50% - 180px);top:80px;width:360px;height:640px;background:#202020}video{width:100%;height:100%;object-fit:cover}a{color:inherit}ytd-reel-video-renderer{display:block}.caption{position:absolute;bottom:20px;left:18px}canvas{display:none}
@media(max-width:500px){#shorts-player{left:30px;width:calc(100vw - 60px);height:70vh}}
</style><h1>KarmoLab 쇼츠 집계 시험</h1><ytd-shorts><ytd-reel-video-renderer><div id="shorts-player"><video muted autoplay playsinline></video><div class="caption"><a id="self" href="/shorts/${ID}">시험 영상</a></div></div></ytd-reel-video-renderer></ytd-shorts><canvas width="360" height="640"></canvas>
<script>const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let step=0;function draw(){ctx.fillStyle='#263238';ctx.fillRect(0,0,360,640);ctx.fillStyle='#8ca5ad';ctx.beginPath();ctx.arc(180,270+Math.sin(++step/10)*70,65,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='18px system-ui';ctx.fillText('Playback test',120,450)}draw();setInterval(draw,100);const video=document.querySelector('video');video.srcObject=canvas.captureStream(10);video.play();</script></html>`;
const card = (name, owner, modern = true) => `<ytd-rich-item-renderer id="${name}"><yt-lockup-view-model><a class="thumb" href="/watch?v=${ID}">영상</a><yt-lockup-metadata-view-model><div class="ytLockupMetadataViewModelTextContainer"><h3>${name}</h3>${modern ? '<yt-content-metadata-view-model>' : '<ytd-channel-name>'}<a href="/@${owner}">${owner}</a>${modern ? '</yt-content-metadata-view-model>' : '</ytd-channel-name>'}<small>조회수 1천회</small></div><button>더보기</button></yt-lockup-metadata-view-model></yt-lockup-view-model></ytd-rich-item-renderer>`;
const feeds = `<!doctype html><html lang="ko" dark><meta charset="utf-8"><title>홈/구독 차단 시험</title><style>
body{background:#111;color:#eee;font:14px system-ui;padding:24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,360px));gap:24px}ytd-rich-item-renderer,yt-lockup-view-model{display:block}yt-lockup-metadata-view-model{display:flex;justify-content:space-between;padding:12px 0}.ytLockupMetadataViewModelTextContainer{display:flex;flex-direction:column}.thumb{display:grid;place-items:center;height:180px;background:#292929;border-radius:10px;color:#ccc}a{color:inherit}h3{margin:0 0 8px;font-size:16px}small{margin-top:4px;color:#aaa}@media(max-width:500px){main{grid-template-columns:1fr}}
</style><h1>홈/구독 카드 시험</h1><main>${card('home', 'same')}${card('subscription', 'same')}${card('legacy', 'other', false)}</main></html>`;

module.exports = { shorts, feeds };
if (require.main === module) (async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kl-count-'));
  const extension = path.join(tmp, 'extension');
  mkdirSync(extension); mkdirSync(output, { recursive: true });
  for (const file of ['features', 'dev', '_locales', 'icons', 'popup.html', 'popup.js']) cpSync(path.join(root, file), path.join(extension, file), { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const publicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' });
  manifest.key = publicKey.toString('base64');
  const extensionId = createHash('sha256').update(publicKey).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
  writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    channel: 'msedge', headless: false, ignoreDefaultArgs: ['--disable-extensions'], locale: 'ko-KR', viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await context.route('https://www.youtube.com/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/fixture-')) return route.fulfill({ body: feeds, contentType: 'text/html' });
      if ([`/shorts/${ID}`, `/shorts/${OTHER}`].includes(url.pathname)) return route.fulfill({ body: shorts, contentType: 'text/html' });
      if (url.pathname === '/youtubei/v1/player') {
        let payload;
        try { payload = JSON.parse(route.request().postData() || '{}'); } catch { /* Public requests may use compression. */ }
        if ([ID, OTHER].includes(payload?.videoId)) return route.fulfill({ json: { microformat: { playerMicroformatRenderer: { publishDate: '2026-10-01' } } } });
      }
      if (['/@same', '/@other'].includes(url.pathname)) return route.fulfill({ body: '', contentType: 'text/html' });
      return route.continue();
    });
    const page = context.pages()[0];
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('https://www.youtube.com/shorts/' + ID);
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-count')?.textContent.startsWith('오늘 1개 / 1회 / '));
    await page.waitForFunction(() => / \/ [1-9]\d*초$/.test(document.querySelector('.karmolab-shorts-count')?.textContent));
    const badge = page.locator('.karmolab-shorts-date');
    const layout = await badge.evaluate(b => ({ text: b.firstChild.textContent, dateTop: b.getBoundingClientRect().top, countTop: b.querySelector('.karmolab-shorts-count').getBoundingClientRect().top }));
    assert.ok(layout.text.includes('2026'));
    assert.ok(layout.countTop > layout.dateTop + 12);
    await page.screenshot({ path: path.join(output, 'shorts-both.png') });
    const navigate = async id => page.evaluate(id => { history.pushState({}, '', '/shorts/' + id); document.querySelector('#self').href = '/shorts/' + id; }, id);
    await navigate(OTHER);
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-count')?.textContent.startsWith('오늘 2개 / 2회 / '));
    await navigate(ID);
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-count')?.textContent.startsWith('오늘 2개 / 3회 / '));
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator('#shortsCountMode:not([disabled])').waitFor();
    await popup.setViewportSize({ width: 320, height: 800 });
    for (const [mode, expected] of [['unique', '오늘 2개'], ['views', '오늘 3회'], ['both', '오늘 2개 / 3회']]) {
      await popup.bringToFront();
      await popup.locator('#shortsCountMode').selectOption(mode);
      await popup.locator('#shortsCountMode:not([disabled])').waitFor();
      await page.bringToFront();
      await page.waitForFunction(text => document.querySelector('.karmolab-shorts-count')?.textContent.startsWith(text + ' / '), expected);
    }
    await popup.bringToFront();
    await popup.locator('#shortsWatchTime').press('Space');
    await popup.locator('#shortsWatchTime:not([disabled])').waitFor();
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-count')?.textContent === '오늘 2개 / 3회');
    await popup.bringToFront();
    await popup.locator('#shortsWatchTime').press('Space');
    await popup.locator('#shortsWatchTime:not([disabled])').waitFor();
    await popup.evaluate(async () => {
      const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const start = Date.now() - 24 * 60000;
      await chrome.storage.local.set({ ['shortsDayTime:' + day + ':fixture']: [[start, start + 23 * 60000]] });
    });
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-count')?.textContent.endsWith(' / 23분'));
    await page.screenshot({ path: path.join(output, 'shorts-watch-time-wide.png') });
    await popup.screenshot({ path: path.join(output, 'popup-count-settings.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const badge = document.querySelector('.karmolab-shorts-date');
      const rect = badge?.getBoundingClientRect();
      return badge && !badge.hidden && badge.dataset.inside === '1' && rect.left >= 0 && rect.right <= innerWidth;
    });
    await page.screenshot({ path: path.join(output, 'shorts-narrow.png') });
    const narrow = await badge.boundingBox();
    assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 390);
    await popup.evaluate(() => chrome.storage.sync.set({ shortsDate: false }));
    await page.waitForFunction(() => document.querySelector('.karmolab-shorts-date')?.dataset.hasDate === '');
    assert.equal((await page.locator('.karmolab-shorts-count').innerText()).replace(/ \/ [^/]+$/, ''), '오늘 2개 / 3회');
    await page.setViewportSize({ width: 320, height: 720 });
    await page.waitForFunction(() => { const r = document.querySelector('.karmolab-shorts-date')?.getBoundingClientRect(); return r && r.left >= 0 && r.right <= innerWidth; });
    await page.screenshot({ path: path.join(output, 'shorts-watch-time-320.png') });
    await popup.evaluate(() => chrome.storage.sync.set({ shortsDate: true }));
    await page.goto('https://www.youtube.com/fixture-home');
    for (const id of ['home', 'subscription', 'legacy']) {
      await page.locator('#' + id + ' .kl-block-button--card').waitFor();
      assert.equal(await page.locator('#' + id + ' .kl-block-button').count(), 1);
      assert.equal(await page.locator('#' + id + ' a .kl-block-button').count(), 0);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(output, 'feed-cards.png') });
    await page.locator('#home .kl-block-button').click();
    await page.waitForFunction(() => document.querySelector('#home').classList.contains('kl-block-hidden'));
    assert.equal(await page.locator('#subscription').isVisible(), false);
    assert.equal(await page.locator('#legacy').isVisible(), true);
    await popup.evaluate(() => chrome.storage.local.remove('blockedChannel:@same'));
    await page.locator('#home .kl-block-button').waitFor();
    assert.equal(await page.locator('#subscription').isVisible(), true);
    await page.evaluate(() => {
      const link = document.querySelector('#home yt-content-metadata-view-model a');
      link.href = '/@recycled'; link.textContent = 'recycled';
    });
    await page.getByRole('button', { name: '차단: recycled', exact: true }).waitFor();
    await page.goto('https://www.youtube.com/fixture-subscriptions');
    await page.locator('#subscription .kl-block-button--card').waitFor();
    assert.equal(await page.locator('#subscription .kl-block-button').count(), 1);
    assert.deepEqual(errors, []);
    if (process.env.VERIFY_PUBLIC === '1') {
      await page.goto('https://www.youtube.com/@veritasium/videos', { waitUntil: 'domcontentloaded' });
      try { await page.locator('.kl-block-button--card').first().waitFor({ timeout: 30000 }); }
      catch (error) {
        await page.screenshot({ path: path.join(output, 'public-channel-failed.png') });
        console.log(await page.evaluate(() => ({ cards: document.querySelectorAll('ytd-rich-item-renderer,yt-lockup-view-model').length, buttons: document.querySelectorAll('.kl-block-button').length, metadata: document.querySelectorAll('#meta,#metadata,.ytLockupMetadataViewModelTextContainer').length })));
        throw error;
      }
      await page.screenshot({ path: path.join(output, 'public-channel-cards.png') });
    }
    const result = { status: 'PASS', browser: 'Edge', actualExtension: manifest.version, realMediaStreamPlayback: true, unique: 2, views: 3, displayModes: 3, watchTimeKeyboardToggle: true, watchTimeFromRealPlayback: true, watchTimeSeeded23Minutes: true, widths: [1440,390,320], dateDisabledIndependent: true, cardButtonPerVideo: 1, feedBlockUnblock: true, recycledCard: true, publicChannelCards: process.env.VERIFY_PUBLIC === '1' };
    writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(result);
  } finally {
    await context.close();
    rmSync(tmp, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
