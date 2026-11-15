const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = readFileSync(process.env.USER_BLOCK_SOURCE || path.join(root, 'features/user-block.js'), 'utf8');
const blocked = 'UCaaaaaaaaaaaaaaaaaaaaaa', allowed = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const first = 'aaaaaaaaaaa', second = 'bbbbbbbbbbb';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.youtube.com/**', route => route.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }));
    async function setup({ stale = false, actualBlocked = false, keyword = false, defer = false, handleOnly = false, channelProfile = false, holdNavigation = false, initialPaused = false, moving = false, bypass = false, enabled = true, keywordShorts = true } = {}) {
      await page.goto('https://www.youtube.com/shorts/' + first);
      await page.evaluate(({ blocked, allowed, first, stale, actualBlocked, keyword, defer, handleOnly, channelProfile, holdNavigation, initialPaused, moving, bypass, enabled, keywordShorts }) => {
        sessionStorage.clear();
        window.clicks = 0;
        window.scans = 0;
        if (holdNavigation) {
          const nativeTimeout = window.setTimeout;
          window.setTimeout = (callback, delay, ...args) => delay === 0 ? (window.queuedNavigation = callback) : nativeTimeout(callback, delay, ...args);
        }
        window.KarmoFilterReview = { bypass: () => bypass, set: () => { window.scans++; }, onChange: () => {} };
        document.body.innerHTML = `<ytd-reel-video-renderer style="display:block;height:800px"><a href="/shorts/${first}">video</a><h3>safe DOM title</h3><a href="/@blocked">mention</a><yt-reel-channel-bar-view-model><a href="/@${stale || actualBlocked ? 'blocked' : 'allowed'}">author</a><div id="subscribe-button"></div></yt-reel-channel-bar-view-model><video></video></ytd-reel-video-renderer><button aria-label="Next video">Next</button>`;
        const video = document.querySelector('video');
        let paused = initialPaused;
        window.resumed = 0;
        Object.defineProperty(video, 'paused', { get: () => paused });
        video.pause = () => { paused = true; };
        video.play = async () => { paused = false; window.resumed++; };
        window.startVideo = () => { paused = false; video.dispatchEvent(new Event('play')); };
        window.motionDone = !moving;
        window.clickedWhileMoving = false;
        if (moving) {
          let top = 64, frames = 0;
          document.querySelector('ytd-reel-video-renderer').getBoundingClientRect = () => new DOMRect(0, top, 600, 800);
          const move = () => {
            top += 2;
            if (++frames < 20) requestAnimationFrame(move); else window.motionDone = true;
          };
          requestAnimationFrame(move);
        }
        document.querySelector('button').onclick = () => {
          window.clicks++;
          if (!window.motionDone) window.clickedWhileMoving = true;
          document.dispatchEvent(new Event('yt-navigate-start'));
          document.querySelector('h3').textContent = 'navigation starting ' + window.clicks;
        };
        const local = { ['blockedChannel:@blocked']: { ids: handleOnly ? ['@blocked'] : ['@blocked', blocked] }, userBlock: enabled, keywordShorts, keywordWords: keyword ? ['forbidden'] : [] };
        window.chrome = { i18n: { getMessage: key => key }, storage: { local: { get: async () => local }, onChanged: { addListener: () => {} } } };
        const response = { videoDetails: { videoId: first, channelId: actualBlocked ? blocked : allowed, author: 'author', title: keyword ? 'forbidden title' : 'safe title' }, microformat: { playerMicroformatRenderer: { ownerProfileUrl: channelProfile ? 'https://www.youtube.com/channel/' + (actualBlocked ? blocked : allowed) : 'http://www.youtube.com/@' + (actualBlocked ? 'blocked' : 'allowed') } } };
        window.fetch = url => String(url).includes('/@') ? Promise.resolve({ ok: true, text: async () => JSON.stringify({ externalId: blocked }) }) : new Promise(resolve => {
          window.release = () => resolve({ ok: true, json: async () => response });
          if (!defer) window.release();
        });
      }, { blocked, allowed, first, stale, actualBlocked, keyword, defer, handleOnly, channelProfile, holdNavigation, initialPaused, moving, bypass, enabled, keywordShorts });
      await page.addScriptTag({ path: path.join(root, 'features/keyword-core.js') });
      await page.addScriptTag({ content: source });
      // 처리된 DOM 상태 대기, 시간 경과만으로 통과 판정 금지
      await page.waitForFunction(defer => defer ? document.querySelector('.kl-block-playback') : window.scans > 0, defer);
    }
    await setup({ actualBlocked: true, moving: true });
    await page.waitForFunction(() => window.clicks === 1);
    assert.equal(await page.evaluate(() => window.clickedWhileMoving), false, 'skip must wait for the previous scroll animation to settle');
    await setup();
    await page.waitForFunction(() => window.resumed === 1);
    assert.equal(await page.evaluate(() => window.clicks), 0, 'a blocked mention is not the video author');
    await setup({ initialPaused: true });
    await page.waitForFunction(() => !document.querySelector('.kl-block-playback'));
    assert.equal(await page.evaluate(() => window.resumed), 0, 'already paused video must stay paused after verification');
    await setup({ initialPaused: true, defer: true });
    await page.evaluate(() => { window.startVideo(); window.release(); });
    await page.waitForFunction(() => window.resumed === 1);
    await setup({ stale: true });
    await page.waitForFunction(() => !document.querySelector('.kl-block-playback'));
    assert.equal(await page.evaluate(() => window.clicks), 0, 'stale blocked channel DOM must not skip an allowed video');
    await setup({ actualBlocked: true, defer: true });
    assert.equal(await page.evaluate(() => window.clicks), 0, 'unverified author must not skip');
    await page.evaluate(() => window.release());
    await page.waitForFunction(() => window.clicks === 1);
    const scans = await page.evaluate(() => window.scans);
    await page.evaluate(() => { document.querySelector('h3').textContent = 'mutation'; });
    await page.waitForFunction(scans => window.scans > scans, scans);
    assert.equal(await page.evaluate(() => window.clicks), 1, 'one skip per blocked visit');
    await page.evaluate(second => {
      history.pushState({}, '', '/shorts/' + second);
      document.querySelector('a[href*="/shorts/"]').href = '/shorts/' + second;
      window.fetch = async () => ({ ok: true, json: async () => ({ videoDetails: { videoId: second, channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb', author: 'allowed', title: 'safe title' } }) });
      document.dispatchEvent(new Event('yt-navigate-finish'));
    }, second);
    await page.waitForFunction(() => !document.querySelector('.kl-block-playback'));
    assert.equal(await page.evaluate(() => window.clicks), 1, 'next allowed video survives reused blocked channel DOM');
    await setup({ keyword: true });
    await page.waitForFunction(() => window.clicks === 1);
    await setup({ actualBlocked: true, handleOnly: true });
    await page.waitForFunction(() => window.clicks === 1);
    await setup({ actualBlocked: true, handleOnly: true, channelProfile: true });
    await page.waitForFunction(() => window.clicks === 1);
    await setup({ actualBlocked: true, handleOnly: true, channelProfile: true, defer: true });
    await page.evaluate(() => {
      document.querySelector('yt-reel-channel-bar-view-model a').href = '/@allowed';
      window.release();
    });
    await page.waitForFunction(() => window.clicks === 1);
    await setup({ stale: true, handleOnly: true, channelProfile: true });
    await page.waitForFunction(() => !document.querySelector('.kl-block-playback'));
    assert.equal(await page.evaluate(() => window.clicks), 0, 'resolved stale handle must match the verified channel');
    await setup({ actualBlocked: true, holdNavigation: true });
    await page.waitForFunction(() => window.queuedNavigation);
    await page.evaluate(second => {
      history.pushState({}, '', '/shorts/' + second);
      window.queuedNavigation();
    }, second);
    assert.equal(await page.evaluate(() => window.clicks), 0, 'queued skip cannot act on a different URL');
    for (const options of [{ actualBlocked: true, bypass: true }, { actualBlocked: true, enabled: false }, { keyword: true, keywordShorts: false }]) {
      await setup(options);
      await page.waitForFunction(() => window.scans > 0);
      assert.equal(await page.evaluate(() => window.clicks), 0, JSON.stringify(options));
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 18 Shorts playback regressions (identity, transition, keyword, alias, bypass, settings, resume, scroll stability)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
