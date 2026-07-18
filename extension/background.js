// KryMark extension — service worker: phím tắt Alt+C + widget bám qua reload.
// activation lưu theo ORIGIN site đang review: { [origin]: {key, instance} } trong storage.local.
// lastActivation = project dùng gần nhất → Alt+C trên site mới tự dùng nó.

async function getActs() {
  const { activations } = await chrome.storage.local.get("activations");
  return activations || {};
}
async function setAct(origin, act) {
  const activations = await getActs();
  activations[origin] = act;
  await chrome.storage.local.set({ activations, lastActivation: act });
}
async function widgetPresent(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!window.__km_pick });
    return !!result;
  } catch {
    return false;
  }
}
async function inject(tabId, key, instance, autopick) {
  if (await widgetPresent(tabId)) {
    if (autopick) await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__km_pick && window.__km_pick() });
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (k, o, ap) => { window.__km_cfg = { key: k, origin: o, autopick: ap }; window.__krymark = false; },
    args: [key, instance, !!autopick],
  });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
}
function badge(tabId, on) {
  chrome.action.setBadgeText({ tabId, text: on ? "◉" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff3d2e" });
}

// Alt+C — vào ngay chế độ chọn element (không cần bấm tab Feedback)
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-feedback") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return;
  const origin = new URL(tab.url).origin;
  const acts = await getActs();
  let act = acts[origin];
  if (!act) {
    const { lastActivation } = await chrome.storage.local.get("lastActivation");
    act = lastActivation;
  }
  if (!act) { badge(tab.id, false); chrome.action.setBadgeText({ tabId: tab.id, text: "?" }); return; }
  if (origin === new URL(act.instance).origin) return; // không review chính dashboard KryMark
  await setAct(origin, act);
  await inject(tab.id, act.key, act.instance, true);
  badge(tab.id, true);
});

// Bám qua reload / điều hướng: site đã activate thì tự chèn lại widget mỗi lần load xong
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url || !/^https?:/.test(tab.url)) return;
  const acts = await getActs();
  const org = new URL(tab.url).origin;
  const act = acts[org];
  if (act && org !== new URL(act.instance).origin) { await inject(tabId, act.key, act.instance, false); badge(tabId, true); }
});
