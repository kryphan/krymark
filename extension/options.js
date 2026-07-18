const $ = (id) => document.getElementById(id);
chrome.storage.sync.get(["origin", "key"], (v) => {
  if (v.origin) $("origin").value = v.origin;
  if (v.key) $("key").value = v.key;
});
$("save").addEventListener("click", async () => {
  const origin = $("origin").value.trim().replace(/\/+$/, "");
  const key = $("key").value.trim();
  if (!/^https?:\/\//.test(origin) || !key) {
    $("msg").style.color = "#ff5a3c";
    $("msg").textContent = "Fill both fields";
    return;
  }
  // verify key thật trước khi lưu
  try {
    const r = await fetch(origin + "/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    $("msg").style.color = "#ff5a3c";
    $("msg").textContent = "Can't reach instance / invalid key";
    return;
  }
  chrome.storage.sync.set({ origin, key }, () => {
    $("msg").style.color = "#4ade80";
    $("msg").textContent = "Saved ✓";
  });
});
