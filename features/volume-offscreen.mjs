import { volumeValue } from './volume-core.mjs';
const sessions = new Map();
function stop(tabId) {
  const session = sessions.get(tabId);
  if (!session) return;
  sessions.delete(tabId);
  session.stream.getTracks().forEach(track => track.stop());
  session.source.disconnect(); session.gain.disconnect();
  void session.context.close();
}
async function command(message) {
  const { tabId } = message;
  if (message.operation === 'stop') { stop(tabId); return { active: false }; }
  if (message.operation === 'status') return { active: sessions.has(tabId), percent: sessions.get(tabId)?.percent };
  const percent = volumeValue(message.percent);
  let session = sessions.get(tabId);
  if (!session && message.operation === 'start') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } }, video: false });
    let context;
    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream), gain = context.createGain();
      gain.gain.value = percent / 100;
      source.connect(gain).connect(context.destination);
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio output is not running');
      session = { stream, context, source, gain, percent };
      sessions.set(tabId, session);
      stream.getAudioTracks()[0].addEventListener('ended', () => { if (sessions.get(tabId) === session) stop(tabId); }, { once: true });
    } catch (error) { stream.getTracks().forEach(track => track.stop()); await context?.close(); throw error; }
  }
  if (!session) return { active: false };
  session.gain.gain.setTargetAtTime(percent / 100, session.context.currentTime, 0.025);
  session.percent = percent;
  return { active: true, percent };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target !== 'volume-offscreen') return;
  command(message).then(result => respond({ ok: true, ...result })).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
