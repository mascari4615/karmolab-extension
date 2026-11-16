/* Fetch only explicitly followed public profiles and their article metadata. */
globalThis.KarmoArcaRead = async (msg) => {
  const feature = await chrome.runtime.sendMessage({ type: 'arca.canRun' });
  if (!feature?.ok) throw new Error(feature?.error || '아카라이브 기능이 꺼져 있습니다.');
  const likes = (await chrome.storage.local.get({ likelist: {} })).likelist.arca || {};
  const key = String(msg.key || '');
  if (!Object.hasOwn(likes, key)) throw new Error('팔로우 목록에서 해제된 작성자입니다.');
  const url = new URL(msg.type === 'arca.liked.read' ? globalThis.KarmoProfile.profileUrl(key) : String(msg.url));
  if (url.origin !== 'https://arca.live' || url.username || url.password || url.search || url.hash) throw new Error('잘못된 아카라이브 주소');
  if (msg.type !== 'arca.liked.read' && !/^\/b\/[^/]+\/\d+$/.test(url.pathname)) throw new Error('글 주소만 허용합니다.');
  const response = await fetch(url.href, { credentials: 'include', redirect: 'error' });
  if (!response.ok) throw new Error(`아카라이브 응답 ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (msg.type === 'arca.liked.read') return { ok: true, rows: globalThis.KarmoProfile.parse(doc, key), at: Date.now() };
  const author = doc.querySelector('.article-head .user-info [data-filter]')?.getAttribute('data-filter') || '';
  const number = /#(\d+)$/.exec(key)?.[1];
  if (number ? /#(\d+)$/.exec(author)?.[1] !== number : author !== key) throw new Error('팔로우 작성자의 글이 아닙니다.');
  let image = '';
  try { const value = new URL(doc.querySelector('meta[property="og:image"]')?.content || ''); if (value.protocol === 'https:' && /(^|\.)(arca\.live|namu\.la)$/.test(value.hostname)) image = value.href; } catch { /* no image */ }
  return { ok: true, embed: { author, image, title: doc.querySelector('meta[property="og:title"]')?.content || '', description: doc.querySelector('meta[property="og:description"]')?.content?.slice(0, 240) || '' } };
};
