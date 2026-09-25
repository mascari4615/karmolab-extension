for (const el of document.querySelectorAll("[data-msg]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.msg);
}

const box = document.getElementById("shortsDate");
chrome.storage.sync.get({ shortsDate: true }, (v) => { box.checked = v.shortsDate !== false; });
box.addEventListener("change", () => chrome.storage.sync.set({ shortsDate: box.checked }));
