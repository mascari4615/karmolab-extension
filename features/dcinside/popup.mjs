const status = document.getElementById('dcinsideStatus');
const toggle = document.getElementById('dcinsideToggle');
const list = document.getElementById('dcinsideBlocks');
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
  const { blocklist } = await chrome.storage.local.get('blocklist');
  if (revision !== listRevision) return;
  list.replaceChildren();
  for (const [key, entry] of Object.entries(blocklist?.dcinside || {})) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = entry.name === key ? key : `${entry.name} (${key})`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '차단 해제';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await send({ type: 'dcinside.remove', key }); }
      catch { status.textContent = '차단 해제에 실패했습니다.'; remove.disabled = false; }
    });
    row.append(name, remove);
    list.append(row);
  }
}

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
  if (area === 'local' && changes.blocklist) renderList().catch(listError);
});
send({ type: 'dcinside.status' }).then(state => {
  renderState(state);
  toggle.disabled = false;
}).catch(() => { status.textContent = '디시인사이드 설정을 읽지 못했습니다.'; });
renderList().catch(listError);
