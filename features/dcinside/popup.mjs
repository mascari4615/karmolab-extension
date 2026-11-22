const status = document.getElementById('dcinsideStatus');
const toggle = document.getElementById('dcinsideToggle');
const list = document.getElementById('dcinsideBlocks');
const galleryList = document.getElementById('dcinsideGalleries');
const galleryForm = document.getElementById('dcinsideGalleryForm');
const galleryInput = document.getElementById('dcinsideGalleryInput');
const currentGallery = document.getElementById('dcinsideCurrentGallery');
const origins = ['https://gall.dcinside.com/*', 'https://m.dcinside.com/*'];
let enabled = false;
let listRevision = 0;

async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw Error(result?.error || '설정에 접근할 수 없습니다.');
  return result;
}

function renderState(state) {
  enabled = state.enabled;
  toggle.textContent = enabled ? '디시인사이드 끄기' : '디시인사이드 켜기';
  status.textContent = enabled ? '켜짐. 이미 열린 디시 탭은 새로고침하세요.' : '꺼짐';
}

async function renderList() {
  const revision = ++listRevision;
  const { blocklist, karmoSettings } = await chrome.storage.local.get(['blocklist', 'karmoSettings']);
  if (revision !== listRevision) return;
  list.replaceChildren();
  galleryList.replaceChildren();
  for (const gallery of karmoSettings?.dcinside?.blockedChannels || []) {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = gallery;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '차단 해제';
    remove.addEventListener('click', () => changeGallery(gallery, true));
    row.append(label, remove);
    galleryList.append(row);
  }
  for (const [key, entry] of Object.entries(blocklist?.dcinside || {})) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = entry.name === key ? key : `${entry.name} (${key})`;
    if (entry.autoKeyword) {
      const reason = document.createElement('small');
      reason.textContent = `키워드 자동 차단: ${entry.autoKeyword}`;
      name.append(reason);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '차단 해제';
    if (entry.autoKeyword) remove.title = '이 작성자를 자동 차단 예외로 등록';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await send({ type: 'dcinside.remove', key }); }
      catch { status.textContent = '차단 해제에 실패했습니다.'; remove.disabled = false; }
    });
    row.append(name, remove);
    list.append(row);
  }
}

async function changeGallery(gallery, remove = false) {
  try {
    await send({ type: 'dcinside.gallery', gallery, remove });
    status.textContent = remove ? '갤러리 차단을 해제했습니다.' : '갤러리를 차단했습니다.';
    return true;
  } catch (error) { status.textContent = error.message; return false; }
}

galleryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (await changeGallery(galleryInput.value)) galleryInput.value = '';
});
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  const gallery = KarmoDcGallery.fromUrl(tab?.url);
  currentGallery.hidden = !gallery;
  if (gallery) currentGallery.addEventListener('click', () => changeGallery(gallery));
}).catch(() => {});

toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try {
    if (!enabled && !await chrome.permissions.request({ origins })) throw Error('디시인사이드 사이트 접근을 허용해 주세요.');
    renderState(await send({ type: 'dcinside.toggle', enabled: !enabled }));
  } catch (error) { status.textContent = error.message; }
  finally { toggle.disabled = false; }
});

const listError = () => { status.textContent = '차단 목록을 읽지 못했습니다.'; };
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.blocklist || changes.karmoSettings)) renderList().catch(listError);
});
send({ type: 'dcinside.status' }).then(state => {
  renderState(state);
  toggle.disabled = false;
}).catch(() => { status.textContent = '디시인사이드 설정을 읽지 못했습니다.'; });
renderList().catch(listError);
