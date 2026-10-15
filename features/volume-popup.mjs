import { siteInfo, volumeValue } from './volume-core.mjs';
const range = document.getElementById('siteVolumeRange'), number = document.getElementById('siteVolumeNumber');
const apply = document.getElementById('volumeApply'), stop = document.getElementById('volumeStop'), status = document.getElementById('volumeStatus');
const msg = key => chrome.i18n.getMessage(key);
for (const control of [range, number]) control.setAttribute('aria-label', msg('volumeValue'));
let tab, site;
async function render() {
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); site = siteInfo(tab.url);
    const result = await chrome.runtime.sendMessage({ type: 'volume-query', tabId: tab.id });
    if (!result?.ok) throw new Error(result?.error || 'Volume service unavailable');
    range.value = number.value = result.sites[site.origin] ?? 100;
    range.disabled = number.disabled = apply.disabled = false; stop.hidden = !result.active;
    status.textContent = site.host + ': ' + number.value + '% ' + msg(result.active ? 'volumeActive' : Number(number.value) > 100 ? 'volumeNeedsActivation' : 'volumeSaved');
  } catch { status.textContent = msg('volumeUnsupported'); }
}
range.addEventListener('input', () => { number.value = range.value; });
number.addEventListener('input', () => { range.value = number.value; });
apply.addEventListener('click', async () => {
  let percent;
  try { percent = volumeValue(number.value); } catch { status.textContent = msg('volumeRangeError'); return; }
  apply.disabled = true;
  range.disabled = number.disabled = stop.disabled = true;
  try {
    if (!await chrome.permissions.request({ origins: [site.pattern], ...(percent > 100 ? { permissions: ['tabCapture'] } : {}) })) { status.textContent = msg('volumeDenied'); return; }
    const result = await chrome.runtime.sendMessage({ type: 'volume-apply', tabId: tab.id, origin: site.origin, percent });
    if (!result?.ok) throw new Error(result?.error || 'Audio output failed');
    await render();
  } catch (error) { status.textContent = msg('volumeError'); console.warn('KarmoLab volume:', error.message); }
  finally { apply.disabled = range.disabled = number.disabled = stop.disabled = false; }
});
stop.addEventListener('click', async () => {
  stop.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'volume-stop', tabId: tab.id });
    if (!result?.ok) throw new Error(result?.error);
    await render();
  } catch { status.textContent = msg('volumeError'); }
  finally { stop.disabled = false; }
});
void render();
