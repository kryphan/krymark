const $ = (id) => document.getElementById(id);
const show = (id) => { $(id).style.display = "block"; };
const hide = (id) => { $(id).style.display = "none"; };
const err = (m) => { $("err").style.display = "block"; $("err").textContent = m; };
const clearErr = () => { $("err").style.display = "none"; };

let INSTANCE = "";
let openedTabId = null; // tab dashboard mình tự mở (đóng lại sau khi xong)

async function startReview(origin, key) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  // Ghi nhớ activation theo site → bám qua reload + Alt+C dùng lại (background xử lý)
  if (tab.url && /^https?:/.test(tab.url) && new URL(tab.url).origin !== new URL(origin).origin) {
    const siteOrigin = new URL(tab.url).origin;
    const { activations } = await chrome.storage.local.get("activations");
    const map = activations || {};
    map[siteOrigin] = { key, instance: origin };
    await chrome.storage.local.set({ activations: map, lastActivation: { key, instance: origin } });
    chrome.action.setBadgeText({ tabId: tab.id, text: "◉" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff3d2e" });
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k, o) => { window.__km_cfg = { key: k, origin: o }; window.__krymark = false; },
    args: [key, origin],
  });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dist/content.js"] });
  if (openedTabId) chrome.tabs.remove(openedTabId).catch(() => {});
  window.close();
}

// Tìm tab dashboard đang mở; không có thì mở ngầm 1 tab (để gọi API CÙNG ORIGIN → cookie tự gửi)
async function dashboardTab() {
  const tabs = await chrome.tabs.query({});
  const t = tabs.find((t) => t.url && t.url.startsWith(INSTANCE));
  if (t) return t.id;
  const nt = await chrome.tabs.create({ url: INSTANCE + "/projects", active: false });
  openedTabId = nt.id;
  await new Promise((res) => {
    const on = (id, info) => { if (id === nt.id && info.status === "complete") { chrome.tabs.onUpdated.removeListener(on); res(); } };
    chrome.tabs.onUpdated.addListener(on);
    setTimeout(res, 8000); // phòng khi không complete
  });
  return nt.id;
}

// gọi API bên trong tab dashboard → same-origin, cookie httpOnly được gửi (không dính 3rd-party)
async function apiInDash(path, opts = {}) {
  const tabId = await dashboardTab();
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (url, o) => {
      try {
        const res = await fetch(url, { credentials: "include", ...o });
        return { status: res.status, body: await res.text() };
      } catch {
        return { status: 0, body: "" };
      }
    },
    args: [INSTANCE + path, opts],
  });
  return r.result;
}

async function detectInstance() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:/.test(tab.url)) return null;
    const origin = new URL(tab.url).origin;
    const r = await fetch(origin + "/api/health");
    if (r.ok && "pb" in (await r.json())) return origin;
  } catch {
    /* not KryMark */
  }
  return null;
}

async function boot() {
  let { instance } = await chrome.storage.sync.get(["instance"]);
  if (!instance) instance = await detectInstance();
  if (instance) chrome.storage.sync.set({ instance });
  if (!instance) { show("need-instance"); return; }
  INSTANCE = instance.replace(/\/+$/, "");
  $("inst-label").textContent = new URL(INSTANCE).host;
  $("inst-foot").textContent = `● ${new URL(INSTANCE).host}`;

  const res = await apiInDash("/api/my-projects");
  if (res.status !== 200) { show("need-login"); return; }

  let projects = [];
  try { projects = JSON.parse(res.body).projects ?? []; } catch { /* */ }
  show("ready");
  if (projects.length) {
    show("proj-wrap");
    const box = $("projects");
    for (const p of projects) {
      const b = document.createElement("button");
      b.textContent = `◉ ${p.name}`;
      b.style.cssText = "display:block;width:100%;text-align:left;background:#1b1b1e;border:1px solid #232326;border-radius:7px;color:#f2f2f3;font-size:12.5px;padding:8px 10px;margin-bottom:5px;cursor:pointer";
      b.addEventListener("click", () => startReview(INSTANCE, p.widget_key));
      box.appendChild(b);
    }
  }

  // Trạng thái site hiện tại: đang review? → cho tắt (widget hết bám qua reload)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:/.test(tab.url)) {
      const siteOrigin = new URL(tab.url).origin;
      const { activations } = await chrome.storage.local.get("activations");
      if (activations?.[siteOrigin]) {
        const el = $("site-status");
        el.style.display = "block";
        el.innerHTML = `◉ Reviewing <b>${new URL(tab.url).host}</b> — persists across reloads. <a href="#" id="stop-site" style="color:#ff5a3c">Stop</a>`;
        $("stop-site").addEventListener("click", async (e) => {
          e.preventDefault();
          const { activations: m } = await chrome.storage.local.get("activations");
          delete m[siteOrigin];
          await chrome.storage.local.set({ activations: m });
          chrome.action.setBadgeText({ tabId: tab.id, text: "" });
          el.innerHTML = "Stopped — reload the page to remove the widget.";
        });
      }
    }
  } catch { /* */ }

  $("create").addEventListener("click", async () => {
    clearErr();
    const name = $("pname").value.trim();
    if (!name) return err("Type a project name.");
    const btn = $("create");
    btn.disabled = true; btn.textContent = "Creating…";
    const r = await apiInDash("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    if (r.status !== 200) { btn.disabled = false; btn.textContent = "Create + review"; return err("Couldn't create — still logged in?"); }
    startReview(INSTANCE, JSON.parse(r.body).widget_key);
  });
}

$("save-instance").addEventListener("click", () => {
  const v = $("instance").value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(v)) return err("Enter your instance URL (https://…).");
  chrome.storage.sync.set({ instance: v }, () => { hide("need-instance"); clearErr(); boot(); });
});
$("open-login").addEventListener("click", () => chrome.tabs.create({ url: INSTANCE + "/login" }));
$("change-inst").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.storage.sync.remove(["instance"], () => { hide("need-login"); show("need-instance"); });
});

boot();
