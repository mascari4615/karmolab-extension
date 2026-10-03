/**
 * 쇼츠 올린 날짜 배지. isolated world, document_idle
 *
 * 날짜 출처: innertube /player 의 microformat.publishDate. 11KB, 0.2초 (2026-09-25 실측)
 *   영상 페이지 통째는 1.26MB, 실패 시에만 사용
 * fixed 배지 하나인 이유: 쇼츠 DOM 의 잦은 변경. 보이는 #shorts-player 자리만 추적
 * 쿠키 제외: 공개 영상 날짜만 필요. 계정 정보 미사용
 * 정본: memo/projects/karmolab/apps/karmolab-extension.md
 */

(() => {
  if (globalThis.__karmoShortsDate) return;
  globalThis.__karmoShortsDate = 1;

  const KEY = "shortsDate";
  const FALLBACK_CLIENT_VERSION = "2.20250101.00.00";
  const TICK_MS = 300;
  const GAP = 12;
  const GUIDE_WIDTH = 72; // 왼쪽 접힌 메뉴 폭

  const cache = new Map(); // videoId -> Date | null (null = 못 얻음)
  const pending = new Set();
  let enabled = true;
  let clientVersion = null;
  let badge = null;
  let placement = null;

  const videoIdFromUrl = () => {
    const m = location.pathname.match(/^\/shorts\/([\w-]{11})/);
    return m ? m[1] : null;
  };

  const readClientVersion = () => {
    if (clientVersion) return clientVersion;
    for (const s of document.scripts) {
      const m = s.textContent && s.textContent.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/);
      if (m) return (clientVersion = m[1]);
    }
    return (clientVersion = FALLBACK_CLIENT_VERSION);
  };

  const fromPlayer = async (id) => {
    const res = await fetch("/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: id,
        context: { client: { clientName: "WEB", clientVersion: readClientVersion() } },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const mf = j && j.microformat && j.microformat.playerMicroformatRenderer;
    return (mf && (mf.publishDate || mf.uploadDate)) || null;
  };

  const fromPage = async (id) => {
    const res = await fetch(`/shorts/${id}`, { credentials: "omit" });
    if (!res.ok) return null;
    const m = (await res.text()).match(/"(?:publishDate|uploadDate)":"([^"]+)"/);
    return m ? m[1] : null;
  };

  const load = async (id) => {
    if (cache.has(id) || pending.has(id)) return;
    pending.add(id);
    let raw = null;
    try { raw = await fromPlayer(id); } catch { /* 아래 대체 경로 */ }
    if (!raw) {
      try { raw = await fromPage(id); } catch { /* 못 얻음 */ }
    }
    const d = raw ? new Date(raw) : null;
    cache.set(id, d && !isNaN(d) ? d : null);
    pending.delete(id);
  };

  const lang = () => document.documentElement.lang || navigator.language || "ko";

  const relative = (d) => {
    const rtf = new Intl.RelativeTimeFormat(lang(), { numeric: "auto" });
    const sec = (d.getTime() - Date.now()) / 1000;
    const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unit, s] of steps) {
      if (Math.abs(sec) >= s) return rtf.format(Math.round(sec / s), unit);
    }
    return rtf.format(0, "minute");
  };

  const longText = (d) => {
    const day = new Intl.DateTimeFormat(lang(), { year: "numeric", month: "numeric", day: "numeric" }).format(d);
    return `${day} (${relative(d)})`;
  };

  const shortText = (d) =>
    new Intl.DateTimeFormat(lang(), { year: "2-digit", month: "numeric", day: "numeric" }).format(d);

  const ensureBadge = () => {
    if (badge && badge.isConnected) return badge;
    badge = document.createElement("div");
    badge.className = "karmolab-shorts-date";
    badge.hidden = true;
    document.documentElement.appendChild(badge);
    return badge;
  };

  // 화면에 가장 넓게 보이는 #shorts-player
  // <video> 기준 제외: 첫 쇼츠는 재생 전 <video> 가 화면 밖 top -640 (2026-09-25 실측)
  const activeVideo = (id) => {
    let best = null;
    let bestArea = 0;
    // 바깥 카드는 영상보다 넓음. 실제 플레이어만 좌표 후보
    for (const v of document.querySelectorAll("ytd-shorts #shorts-player")) {
      const renderer = v.closest("ytd-reel-video-renderer");
      const ids = renderer ? Array.from(renderer.querySelectorAll('a[href*="/shorts/"]'))
        .map(a => (a.getAttribute("href") || "").match(/\/shorts\/([\w-]{11})(?:[/?#]|$)/)?.[1])
        .filter(Boolean) : [];
      // 주소가 먼저 바뀌고 이전 영상 DOM이 남는 전환 구간 제외
      if (ids.length && !ids.includes(id)) continue;
      const r = v.getBoundingClientRect();
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      const area = w > 0 && h > 0 ? w * h : 0;
      if (area > bestArea) { best = { node: v, rect: r }; bestArea = area; }
    }
    return best;
  };

  const stableRect = (id) => {
    const candidate = activeVideo(id);
    if (!candidate) { placement = null; return null; }
    const { node, rect } = candidate;
    const previous = placement;
    placement = { id, node, rect };
    if (!previous || previous.id !== id || previous.node !== node) return null;
    // 움직이는 쇼츠를 따라 배지가 미끄러지는 현상 방지
    if (["left", "top", "width", "height"].some(k => Math.abs(previous.rect[k] - rect[k]) > 1)) return null;
    return rect;
  };

  const tick = () => {
    const id = enabled ? videoIdFromUrl() : null;
    if (!id) {
      placement = null;
      if (badge) badge.hidden = true;
      return;
    }
    const b = ensureBadge();
    const rect = stableRect(id);
    if (!cache.has(id)) {
      load(id);
      b.hidden = true;
      return;
    }
    const d = cache.get(id);
    if (!d || !rect) {
      b.hidden = true;
      return;
    }
    // 자리: 영상 밖 왼쪽. 영상 가림 금지 (사용자 2026-09-25)
    // 자리 부족 시 짧은 형식, 그래도 부족하면 짧은 형식을 영상 안쪽에
    const full = longText(d);
    const room = rect.left - GAP - GUIDE_WIDTH;
    const key = `${id}|${Math.round(room)}|${Math.floor(Date.now() / 60000)}`;
    b.hidden = false;
    if (b.dataset.key !== key) {
      b.dataset.key = key;
      b.textContent = full;
      if (b.offsetWidth > room) b.textContent = shortText(d);
      b.dataset.inside = b.offsetWidth <= room ? "" : "1";
      b.title = d.toLocaleString(lang());
    }
    b.style.left = `${b.dataset.inside ? Math.max(rect.left, 0) + GAP : rect.left - GAP - b.offsetWidth}px`;
    b.style.top = `${Math.max(rect.top, 0) + GAP}px`;
  };

  chrome.storage.sync.get({ [KEY]: true }, (v) => { enabled = v[KEY] !== false; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[KEY]) enabled = changes[KEY].newValue !== false;
  });

  setInterval(tick, TICK_MS);
})();
