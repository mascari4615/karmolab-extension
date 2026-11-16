const UL_STATE = 'arcaExport';
async function exportUserlists() {
  try {
    const data = await chrome.storage.local.get(['blocklist', 'likelist', 'karmoSettings']);
    const snapshot = { version: 1, block: { arca: data.blocklist?.arca || {} }, like: { arca: data.likelist?.arca || {} }, settings: { arca: data.karmoSettings?.arca || {} } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'karmolab-arca.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const state = { at: Date.now(), file: anchor.download, block: Object.keys(snapshot.block.arca).length, like: Object.keys(snapshot.like.arca).length };
    await chrome.storage.local.set({ [UL_STATE]: state });
    return state;
  } catch (error) { return { error: error.message }; }
}
async function exportStats() { return { skipped: true }; }
