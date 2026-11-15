export async function nativeShortsPlayback(action, videoId) {
  const current = () => location.origin === 'https://www.youtube.com' && location.pathname === '/shorts/' + videoId;
  if (!/^[\w-]{11}$/.test(videoId) || !current()) return { ok: false };
  const shorts = document.querySelector('ytd-shorts');
  if (shorts?.currentEndpoint?.reelWatchEndpoint?.videoId !== videoId) return { ok: false };
  if (action === 'recover') {
    const index = shorts.index, nextIndex = index + 1;
    const nextId = shorts.shortsProcessedSequence?.[nextIndex]?.command?.reelWatchEndpoint?.videoId;
    if (!Number.isInteger(index) || shorts.currentPlayerIndex !== nextIndex || typeof shorts.loadVideo !== 'function'
      || !/^[\w-]{11}$/.test(nextId) || nextId === videoId
      || !document.querySelector('ytd-reel-video-renderer.kl-block-playback')) return { ok: false };
    // 이전 이동에서 남은 플레이어 번호만 현재 endpoint에 맞춰 native 로더 복구
    shorts.currentPlayerIndex = index;
    shorts.loadVideo(nextIndex);
    return { ok: true, nextId };
  }
  if (action !== 'resume') return { ok: false };
  const started = performance.now();
  while (current() && document.visibilityState === 'visible' && performance.now() - started < 5000) {
    const player = document.querySelector('#shorts-player');
    const root = player?.closest('ytd-reel-video-renderer');
    if (root?.classList.contains('kl-block-playback')) return { ok: false };
    if (player?.getVideoData?.().video_id === videoId && typeof player.playVideo === 'function') {
      player.playVideo();
      return { ok: true };
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return { ok: false };
}

export function registerShortsPlayback(api) {
  api.runtime.onMessage.addListener((message, sender, respond) => {
    const action = message?.type === 'shorts-playback-recover' ? 'recover' : message?.type === 'shorts-playback-resume' ? 'resume' : null;
    if (!action || sender.id !== api.runtime.id || sender.frameId !== 0 || !sender.tab?.id || !/^[\w-]{11}$/.test(message.videoId)) return;
    const expected = 'https://www.youtube.com/shorts/' + message.videoId;
    if (sender.url?.split(/[?#]/)[0] !== expected) return;
    api.tabs.get(sender.tab.id).then(tab => {
      if (tab.url?.split(/[?#]/)[0] !== expected) return { ok: false };
      return api.scripting.executeScript({ target: { tabId: sender.tab.id }, world: 'MAIN', func: nativeShortsPlayback, args: [action, message.videoId] })
        .then(results => results[0]?.result || { ok: false });
    }).then(respond).catch(() => respond({ ok: false }));
    return true;
  });
}
