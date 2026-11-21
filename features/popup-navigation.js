(() => {
  const node = id => document.getElementById(id);
  const section = id => node(id)?.closest('section');
  document.body.classList.add('kl-popup');
  const host = document.createElement('div'); document.querySelector('header').after(host);
  const youtube = document.createElement('iframe'); youtube.src = 'features/youtube-settings.html'; youtube.title = 'YouTube settings'; youtube.className = 'kl-settings-frame';
  const arca = document.createElement('iframe'); arca.src = 'features/arca/options.html'; arca.title = '아카라이브 설정'; arca.className = 'kl-settings-frame'; arca.id = 'arcaSettingsFrame'; arca.hidden = true;
  const arcaSection = section('arcaHeading'); arcaSection.append(arca);
  const navigation = globalThis.KarmoSettingsNavigation(host, [
    { id:'youtube', title:'유튜브', en:'YouTube', nodes:[youtube] },
    { id:'arca', title:'아카라이브', en:'Arca.live', nodes:[section('arcaHeading')] },
    { id:'dcinside', title:'디시인사이드', en:'DC Inside', nodes:[section('dcinsideHeading')] },
    { id:'sites', title:'사이트 도구', en:'Site tools', hint:'현재 사이트에 적용합니다.', hintEn:'Apply tools to the site you are viewing.', nodes:[section('darkModeHeading'), section('volumeHeading'), section('base64Heading')] },
  ], 'kl-popup');
  function openKeywords() {
    navigation.select('youtube');
    youtube.contentWindow.postMessage('karmolab.openKeywords', location.origin);
  }
  node('dcinsideKeywords').addEventListener('click', openKeywords);
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === arca.contentWindow && event.data === 'karmolab.openKeywords') openKeywords();
  });
  if (location.hash === '#keywords') youtube.addEventListener('load', openKeywords, { once: true });
  chrome.storage.session.get('panelSection').then(({panelSection}) => { if(panelSection) { navigation.select(panelSection); return chrome.storage.session.remove('panelSection'); } }).catch(() => {});
})();
