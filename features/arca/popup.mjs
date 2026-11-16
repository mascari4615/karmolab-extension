const status = document.getElementById('arcaStatus');
const toggle = document.getElementById('arcaToggle');
let enabled = false;
async function render(changed = false) {
  const result = await chrome.runtime.sendMessage({ type: 'arca.feature.status' });
  enabled = !!result.state?.enabled;
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.textContent = enabled ? '아카라이브 기능 끄기' : '아카라이브 켜기';
  status.textContent = enabled ? (result.permission ? '사용 중. 아래에서 차단과 팔로우를 관리하세요.' : '사이트 권한이 없습니다. 껐다가 다시 켜세요.') : '차단, 팔로우 글, 읽음 표시, 스크랩과 통계를 함께 관리합니다.';
  if (changed) status.textContent += ' 변경 사항을 적용하려면 열린 아카라이브 탭을 새로고침하세요. 저장된 목록은 유지됩니다.';
  document.getElementById('arcaManage').disabled = !enabled;
  document.getElementById('arcaSettingsFrame').hidden = !enabled;
  document.getElementById('arcaManage').hidden = enabled;
  toggle.disabled = false;
}
toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try {
    if (!enabled && !await chrome.permissions.request({ origins: ['https://arca.live/*'] })) throw new Error('사이트 접근이 허용되지 않았습니다.');
    status.textContent = enabled ? '끄는 중...' : '켜는 중...';
    const result = await chrome.runtime.sendMessage({ type: enabled ? 'arca.feature.disable' : 'arca.feature.enable' });
    if (!result.ok) throw new Error(result.error);
    await render(true);
  } catch (error) { status.textContent = error.message; toggle.disabled = false; }
});
document.getElementById('arcaManage').addEventListener('click', () => { document.getElementById('arcaSettingsFrame').hidden = false; });
render().catch(error => { status.textContent = error.message; });
