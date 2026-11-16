chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'karmolab.panel.open') return false;
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || !/^https:\/\/www\.youtube\.com\//.test(sender.url || '')) return false;
  chrome.storage.session.set({ panelSection:'youtube' }).then(() => chrome.action.openPopup({ windowId: sender.tab.windowId })).then(() => respond({ ok:true }), () => respond({ ok:false }));
  return true;
});
