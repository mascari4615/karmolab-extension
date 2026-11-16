const status = document.getElementById('arcaStatus');
const toggle = document.getElementById('arcaToggle');
let enabled = false;
async function render() {
  const result = await chrome.runtime.sendMessage({ type: 'arca.feature.status' });
  enabled = !!result.state?.enabled;
  toggle.textContent = enabled ? '아카라이브 기능 끄기' : '아카라이브 켜기, 기존 데이터 이전';
  status.textContent = enabled ? `${result.state.migrated ? 'Dev 데이터 이전 완료. ' : ''}${result.permission ? '열린 아카라이브 탭은 새로고침하세요.' : '사이트 권한이 없습니다. 껐다가 다시 켜세요.'}` : '차단, 팔로우 글, 읽음 표시, 스크랩과 통계를 함께 관리합니다.';
  document.getElementById('arcaManage').disabled = !enabled;
  toggle.disabled = false;
}
toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try {
    if (!enabled && !await chrome.permissions.request({ origins: ['https://arca.live/*'] })) throw new Error('사이트 접근이 허용되지 않았습니다.');
    status.textContent = enabled ? '끄는 중...' : '기존 데이터를 저장하고 이전하는 중...';
    const result = await chrome.runtime.sendMessage({ type: enabled ? 'arca.feature.disable' : 'arca.feature.enable' });
    if (!result.ok) throw new Error(result.error);
    await render();
  } catch (error) { status.textContent = error.message; toggle.disabled = false; }
});
document.getElementById('arcaManage').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'arca.settings.open' }));
render().catch(error => { status.textContent = error.message; });
