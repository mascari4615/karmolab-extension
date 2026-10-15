const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { readFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.VERIFY_OUTPUT || path.join(root, 'dist', 'verify-user-block');
const channel = 'UCaaaaaaaaaaaaaaaaaaaaaa';
let source = readFileSync(process.env.USER_BLOCK_SOURCE || path.join(root, 'features/user-block.js'), 'utf8');
if (process.env.VERIFY_MUTATION === '1') source = source.replace('const blocked = id =>', 'const blocked = id => false &&');
const messages = JSON.parse(readFileSync(path.join(root, '_locales/ko/messages.json'), 'utf8'));
const fixture = `<!doctype html><html lang="ko"><meta charset="utf-8"><body style="font:16px Arial">
<ytd-video-renderer id="blockedVideo"><ytd-channel-name><a href="/@test">같은 이름</a></ytd-channel-name>차단할 영상</ytd-video-renderer>
<ytd-video-renderer id="otherVideo"><ytd-channel-name><a href="/@other">같은 이름</a></ytd-channel-name>남길 영상</ytd-video-renderer>
<ytm-shorts-lockup-view-model id="shortCard"><a href="/shorts/abcdefghijk">쇼츠 썸네일</a></ytm-shorts-lockup-view-model>
<ytd-comment-thread-renderer id="thread"><ytd-comment-view-model id="comment"><div id="header-author"><a id="author-text" href="/@test">@test</a></div>차단할 댓글<div id="action-buttons"><div id="toolbar"><button>답글</button></div></div></ytd-comment-view-model><div>답글 포함</div></ytd-comment-thread-renderer>
<ytd-comment-thread-renderer id="otherThread"><ytd-comment-view-model><a id="author-text" href="/@other">@other</a>남길 댓글</ytd-comment-view-model><ytd-comment-view-model id="reply"><a id="author-text" href="/@test">@test</a>차단할 답글</ytd-comment-view-model></ytd-comment-thread-renderer>
<ytd-reel-video-renderer style="display:block;width:300px;height:170px"><yt-reel-channel-bar-view-model style="display:flex;align-items:center"><a href="/@test">@test</a><div class="ytReelChannelBarViewModelReelSubscribeButton"><button>구독</button></div></yt-reel-channel-bar-view-model><video></video></ytd-reel-video-renderer>
</body></html>`;

async function setup(page) {
  await page.addInitScript(({ messages }) => {
    const listeners = [];
    const local = JSON.parse(sessionStorage.getItem('kl-fixture') || '{}');
    const changed = entries => listeners.forEach(listener => listener(entries, 'local'));
    window.chrome = {
      i18n: { getMessage: (key, value) => (messages[key]?.message || key).replace('$NAME$', value || '') },
      storage: {
        local: {
          get: async () => ({ ...local }),
          set: async values => {
            if (window.failSave) throw Error('storage failure');
            Object.assign(local, values); sessionStorage.setItem('kl-fixture', JSON.stringify(local));
            changed(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])));
          },
          remove: async key => { delete local[key]; sessionStorage.setItem('kl-fixture', JSON.stringify(local)); changed({ [key]: {} }); },
        },
        sync: { get: (defaults, callback) => callback(defaults), set: async () => {} },
        onChanged: { addListener: fn => listeners.push(fn) },
      },
    };
  }, { messages });
  await page.route('https://www.youtube.com/**', route => {
    const url = route.request().url();
    if (url.includes('/youtubei/')) return route.fulfill({ json: { videoDetails: { channelId: channel, author: '@test' } } });
    if (url.includes('/@test')) return route.fulfill({ body: `{"externalId":"${channel}"}` });
    if (url.includes('/fixture')) return route.fulfill({ body: fixture, contentType: 'text/html' });
    if (url.endsWith('/popup.js')) return route.fulfill({ body: readFileSync(path.join(root, 'popup.js'), 'utf8'), contentType: 'application/javascript' });
    if (url.includes('/popup')) return route.fulfill({ body: readFileSync(path.join(root, 'popup.html'), 'utf8'), contentType: 'text/html' });
    if (url.includes('/icons/')) return route.fulfill({ body: readFileSync(path.join(root, 'icons', path.basename(url))), contentType: 'image/png' });
    return route.fulfill({ body: '' });
  });
}
async function loadFixture(page) {
  await page.goto('https://www.youtube.com/fixture');
  await page.addStyleTag({ path: path.join(root, 'features/user-block.css') });
  await page.addScriptTag({ content: source });
  await page.locator('#comment .kl-block-button').waitFor({ state: 'attached' });
}
(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await setup(page);
    await loadFixture(page);
    assert.equal(await page.locator('#header-author .kl-block-button').count(), 0, 'author row stays clean');
    assert.equal(await page.locator('#comment #toolbar > .kl-block-button').count(), 1, 'block joins comment actions');
    assert.equal(await page.locator('.ytReelChannelBarViewModelReelSubscribeButton + .kl-block-button').count(), 1, 'channel block follows Subscribe');
    await page.evaluate(() => {
      const late = document.createElement('ytd-comment-view-model'); late.id = 'late';
      late.innerHTML = '<a id="author-text" href="/@other">@other</a>';
      document.body.append(late);
    });
    await page.locator('#late > .kl-block-button').waitFor();
    await page.evaluate(() => {
      const actions = document.createElement('div'); actions.id = 'action-buttons';
      actions.innerHTML = '<div id="toolbar"><button>답글</button></div>';
      document.querySelector('#late').append(actions);
    });
    await page.locator('#late #toolbar > .kl-block-button').waitFor();
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.toggleAttribute('dark', value), dark);
      const visual = await page.locator('.kl-block-button--shorts').evaluate(button => ({ height: button.getBoundingClientRect().height, color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor }));
      assert.ok(visual.height >= 36);
      assert.equal(visual.color, 'rgb(255, 255, 255)');
      assert.equal(visual.background, 'rgb(39, 39, 39)');
    }
    await page.locator('#comment .kl-block-button').focus();
    assert.equal(await page.locator('#comment .kl-block-button').evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
    await page.screenshot({ path: path.join(output, 'before.png') });
    await page.locator('#comment .kl-block-button').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#thread')).display === 'none', null, { timeout: 5000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#shortCard')).display === 'none');
    for (const id of ['blockedVideo', 'thread', 'reply']) assert.equal(await page.locator('#' + id).isVisible(), false, id);
    for (const id of ['otherVideo', 'otherThread']) assert.equal(await page.locator('#' + id).isVisible(), true, id);
    assert.equal(await page.locator('.kl-block-notice').isVisible(), true);
    await page.evaluate(() => chrome.storage.local.remove('blockedChannel:@test'));
    await page.waitForFunction(() => !document.querySelector('#comment .kl-block-button').disabled);
    await page.locator('#comment .kl-block-button').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#thread')).display === 'none');
    await page.screenshot({ path: path.join(output, 'blocked.png') });
    await loadFixture(page);
    assert.equal(await page.locator('#thread').isVisible(), false, 'persist after navigation');
    await page.evaluate(() => chrome.storage.local.set({ userBlock: false }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#thread')).display !== 'none');
    assert.equal(await page.locator('.kl-block-button').count(), 0);
    await page.evaluate(() => chrome.storage.local.set({ userBlock: true }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#thread')).display === 'none');
    await page.evaluate(() => {
      const node = document.createElement('ytd-video-renderer'); node.id = 'dynamic';
      node.innerHTML = '<ytd-channel-name><a href="/@test">동적 영상</a></ytd-channel-name>';
      document.body.append(node);
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#dynamic')).display === 'none');
    await page.goto('https://www.youtube.com/popup');
    await page.locator('#blockedList button').waitFor();
    await page.screenshot({ path: path.join(output, 'popup.png') });
    await page.locator('#blockedList button').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('#blockedList li').length === 0);
    await loadFixture(page);
    assert.equal(await page.locator('#thread').isVisible(), true, 'unblock restores');
    await page.evaluate(() => { window.failSave = true; });
    await page.locator('#comment .kl-block-button').click();
    await page.getByRole('button', { name: '차단 재시도', exact: true }).waitFor();
    assert.equal(await page.locator('#thread').isVisible(), true, 'failed save keeps content');
    assert.deepEqual(errors, []);
    console.log('PASS: action-row placement, Subscribe sibling, light/dark contrast colors, 36px channel target, keyboard focus, block/unblock/reblock, same-name isolation, replies, Shorts metadata, playback cover, persistence, toggle, dynamic DOM, popup keyboard unblock, save failure; page errors 0');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
