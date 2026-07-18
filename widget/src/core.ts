// KryMark widget CORE — dùng chung 3 đường: embed (main.ts), bookmarklet (cùng w.js),
// extension (ext-entry.ts). Vanilla TS, Shadow DOM, KHÔNG React.
// snapdom KHÔNG bundle (nặng ~120KB): lazy-load CDN đúng lúc gửi — ảnh là best-effort,
// CDN fail = chỉ mất ảnh, note vẫn đi. Pin version khớp devDep để test local = prod.
// Độ tin cậy 99% (Dang chốt): snapdom SELF-HOST cùng origin với w.js (bỏ phụ thuộc
// CDN ngoài — nguồn fail lớn nhất: adblock/CSP/mạng chặn jsdelivr); jsdelivr chỉ còn là fallback.
const SNAPDOM_CDN = "https://cdn.jsdelivr.net/npm/@zumer/snapdom@2.16.0/dist/snapdom.mjs";
const dynImport = (u: string): Promise<any> => new Function("u", "return import(u)")(u);
let snapdomPromise: Promise<any> | null = null;
let snapdomSelfUrl = ""; // boot set sau khi biết origin
let injectedSnapdom: any = null; // extension bundle sẵn snapdom (CSP extension cấm import remote)
export function provideSnapdom(sd: any) { injectedSnapdom = sd; }
const loadSnapdom = (): Promise<any> => {
  if (injectedSnapdom) return Promise.resolve(injectedSnapdom);
  if (!snapdomPromise) {
    const p: Promise<any> = (snapdomSelfUrl ? dynImport(snapdomSelfUrl) : Promise.reject())
      .catch(() => dynImport(SNAPDOM_CDN))
      .then((m: any) => m.snapdom);
    p.catch(() => {
      if (snapdomPromise === p) snapdomPromise = null; // cả 2 nguồn fail → thử lại lần sau
    });
    snapdomPromise = p;
  }
  return snapdomPromise;
};

const DICTS = {
  en: {
    fab: "Feedback", hint: "Tap the spot you want to comment on", cancel: "Exit",
    bigger: "↑ Bigger area", placeholder: "What should this be like? Just say it naturally…",
    contact: "+ Add name/email (optional)", name: "Name", email: "Email",
    send: "Send feedback", sending: "Sending…", sent: "Sent ✓ Thank you!",
    failed: "Couldn't send — flaky network, please try again.",
    routed: "Page changed — please reselect the spot.", empty: "Type a few words first.",
    myNotes: "My notes", again: "Send another", removeShot: "Remove screenshot",
    shotCap: "Screenshot to attach — remove if it shows something private",
    myTitle: "My notes on this site",
  },
  vi: {
    fab: "Góp ý", hint: "Chạm vào chỗ bạn muốn góp ý", cancel: "Thoát",
    bigger: "↑ Vùng lớn hơn", placeholder: "Bạn muốn chỗ này thế nào? Cứ nói tự nhiên…",
    contact: "+ Thêm tên/email (không bắt buộc)", name: "Tên", email: "Email",
    send: "Gửi góp ý", sending: "Đang gửi…", sent: "Đã gửi ✓ Cảm ơn bạn!",
    failed: "Chưa gửi được — mạng chập chờn, bạn thử lại giúp nhé.",
    routed: "Trang vừa chuyển — chọn lại chỗ góp ý nhé.", empty: "Bạn gõ vài chữ đã nhé.",
    myNotes: "Góp ý của tôi", again: "Gửi thêm", removeShot: "Bỏ ảnh",
    shotCap: "Ảnh sẽ đính kèm — bỏ đi nếu có gì riêng tư",
    myTitle: "Góp ý của bạn trên trang này",
  },
} as const;

// lang: 'vi'|'en' hint (embed data-lang / extension); nếu rỗng → hỏi server theo widget_key
export async function bootKrymark(KEY: string, ORIGIN: string, langHint?: string): Promise<void> {
  if (!KEY || (window as any).__krymark) return; // chống nhúng đôi
  (window as any).__krymark = true;

  const API = ORIGIN + "/api/report";
  snapdomSelfUrl = ORIGIN + "/vendor/snapdom.mjs";
  let LANG: "vi" | "en" = langHint === "vi" ? "vi" : langHint === "en" ? "en" : "en";
  if (!langHint) {
    try {
      const cfg = await fetch(`${ORIGIN}/api/widget-config?key=${encodeURIComponent(KEY)}`, {
        signal: AbortSignal.timeout(3000),
      }).then((r) => r.json());
      if (cfg?.lang === "vi") LANG = "vi";
    } catch {
      /* dùng EN mặc định */
    }
  }
  const T = DICTS[LANG];

  // ---------- Shadow host ----------
  const host = document.createElement("div");
  host.id = "krymark-root";
  const shadow = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.fab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483600;
  writing-mode:vertical-rl;padding:14px 8px;background:#fff;color:#1c1c1e;border:1px solid #e3e3e6;
  border-right:0;border-radius:10px 0 0 10px;box-shadow:-2px 2px 12px rgba(0,0,0,.08);
  font-size:13px;font-weight:600;cursor:pointer;letter-spacing:.04em;display:flex;align-items:center;gap:6px}
.fab .dot{width:8px;height:8px;border-radius:50%;background:#ff3d2e}
.hintbar{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483601;
  background:#fff;color:#1c1c1e;border:1px solid #e3e3e6;border-radius:999px;padding:9px 16px;
  font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.12);display:flex;gap:12px;align-items:center;max-width:calc(100vw - 24px)}
.hintbar .dot{width:8px;height:8px;border-radius:50%;background:#ff3d2e;flex:none}
.hintbar button{border:0;background:none;color:#8f8f96;font-size:12px;cursor:pointer;padding:2px 4px}
.hl{position:fixed;z-index:2147483599;pointer-events:none;border:2px solid #ff3d2e;border-radius:4px;
  background:rgba(255,61,46,.06);transition:all .06s ease-out}
.hl .tag{position:absolute;top:-22px;left:-2px;background:#ff3d2e;color:#fff;font-size:10px;
  font-family:ui-monospace,Menlo,monospace;padding:2px 7px;border-radius:3px;white-space:nowrap}
.sheet{position:fixed;z-index:2147483602;background:#fff;color:#1c1c1e;border:1px solid #e3e3e6;
  border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:16px;width:340px;max-width:calc(100vw - 24px)}
.sheet.bottom{left:0;right:0;bottom:0;width:100%;max-width:100%;border-radius:16px 16px 0 0;
  padding-bottom:max(16px, env(safe-area-inset-bottom))}
.sheet .sel{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#8f8f96;margin:0 0 8px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sheet .sel b{color:#ff3d2e;font-weight:600}
.sheet textarea{width:100%;min-height:88px;border:1px solid #e3e3e6;border-radius:9px;padding:10px 12px;
  font-size:15px;line-height:1.45;resize:vertical;color:#1c1c1e;background:#fff}
.sheet textarea:focus{outline:none;border-color:#ff5a3c}
.row{display:flex;gap:8px;margin-top:10px}
.btn{flex:1;padding:10px 12px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #e3e3e6;background:#fff;color:#1c1c1e}
.btn.primary{background:#ff3d2e;border-color:#ff3d2e;color:#fff}
.btn.primary:disabled{opacity:.6;cursor:default}
.linky{border:0;background:none;color:#8f8f96;font-size:12px;cursor:pointer;padding:6px 0;text-align:left}
.contact{display:none;gap:8px;margin-top:8px}
.contact.open{display:flex}
.contact input{flex:1;min-width:0;border:1px solid #e3e3e6;border-radius:8px;padding:8px 10px;font-size:13px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483603;
  background:#1c1c1e;color:#fff;padding:11px 18px;border-radius:999px;font-size:14px;
  box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:calc(100vw - 24px)}
.toast.ok::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3d2e;margin-right:8px}
.err{color:#ff3d2e;font-size:12px;margin:6px 0 0}
.rubber{position:fixed;z-index:2147483601;border:1.5px dashed #ff3d2e;background:rgba(255,61,46,.06);pointer-events:none}
.shotprev{position:relative;margin-top:10px;display:none}
.shotprev.on{display:block}
.shotprev img{max-height:72px;max-width:100%;border-radius:8px;border:1px solid #e3e3e6;display:block}
.shotprev button{position:absolute;top:-7px;left:-7px;width:20px;height:20px;border-radius:50%;border:1px solid #e3e3e6;background:#fff;color:#8f8f96;font-size:11px;line-height:1;cursor:pointer}
.shotprev .cap{font-size:10px;color:#8f8f96;margin-top:3px}
.mypanel{position:fixed;right:12px;top:56px;z-index:2147483602;width:290px;max-width:calc(100vw - 24px);background:#fff;color:#1c1c1e;border:1px solid #e3e3e6;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:14px;max-height:60vh;overflow-y:auto}
.mypanel h4{margin:0 0 8px;font-size:13px}
.mypanel .it{border-top:1px solid #f0f0f2;padding:8px 0;font-size:12.5px}
.mypanel .it .st{font-size:10.5px;color:#34a853;margin-top:2px}
.mypanel .close{float:right;border:0;background:none;color:#8f8f96;cursor:pointer;font-size:12px}
.toast .again{margin-left:10px;background:#fff;color:#1c1c1e;border:0;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer}`;
  shadow.appendChild(style);

  // ---------- state ----------
  let mode: "idle" | "pick" | "compose" = "idle";
  let hovered: Element | null = null;
  let selected: Element | null = null;
  let pendingShot: Promise<string | null> | null = null; // #9: chụp NGAY khi chọn → preview
  let shotRemoved = false;
  let lastShotErr = "";
  let dragStart: { x: number; y: number } | null = null; // #9: kéo-khung
  let dragging = false;
  let suppressClick = false;

  // #8: sổ note đã gửi (localStorage per widget key) + autofill danh tính
  const SENT_KEY = `km_sent_${KEY}`;
  const ID_KEY = "km_identity";
  const readJson = <T,>(k: string, fb: T): T => {
    try { return JSON.parse(localStorage.getItem(k) ?? "") as T; } catch { return fb; }
  };
  const sentNotes = (): { c: string; t: number }[] => readJson(SENT_KEY, []);

  const fab = el("button", "fab");
  fab.innerHTML = `<span class="dot"></span>${T.fab}`;
  fab.addEventListener("click", () => (mode === "idle" ? enterPick() : exitAll()));
  shadow.appendChild(fab);

  const hl = el("div", "hl");
  hl.style.display = "none";
  hl.innerHTML = `<span class="tag"></span>`;
  shadow.appendChild(hl);

  let hintbar: HTMLElement | null = null;
  let sheet: HTMLElement | null = null;
  let panel: HTMLElement | null = null;
  const rubber = el("div", "rubber");
  rubber.style.display = "none";
  shadow.appendChild(rubber);

  function el(tag: string, cls?: string): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ---------- auto-snap (ux-spec: phần tử có nghĩa thị giác, KHÔNG cây DOM) ----------
  const SEMANTIC = /^(button|a|img|input|select|textarea|nav|header|footer|section|article|form|table|ul|ol|h1|h2|h3|h4|h5|h6|video|figure|label)$/i;
  function meaningful(e: Element): boolean {
    if (e === document.body || e === document.documentElement) return false;
    const r = (e as HTMLElement).getBoundingClientRect();
    if (r.width < 18 || r.height < 14) return false;
    if (r.width * r.height > innerWidth * innerHeight * 0.7) return false;
    if (SEMANTIC.test(e.tagName) || (e as HTMLElement).id) return true;
    const cs = getComputedStyle(e as HTMLElement);
    return (
      (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") ||
      cs.boxShadow !== "none" ||
      parseFloat(cs.borderTopWidth) > 0
    );
  }
  function snap(from: Element): Element {
    let e: Element | null = from;
    while (e && !meaningful(e)) e = e.parentElement;
    return e ?? from;
  }
  function biggerArea(from: Element): Element {
    let e: Element | null = from.parentElement;
    while (e && !meaningful(e)) e = e.parentElement;
    return e && e !== document.body ? e : from;
  }

  function cssPath(e: Element): string {
    const parts: string[] = [];
    let cur: Element | null = e;
    while (cur && cur !== document.body && parts.length < 8) {
      if ((cur as HTMLElement).id) {
        parts.unshift(`#${(cur as HTMLElement).id}`);
        break;
      }
      const tag = cur.tagName.toLowerCase();
      const parent: Element | null = cur.parentElement;
      let sel = tag;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        if (same.length > 1) sel += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(sel);
      cur = parent;
    }
    return parts.join(" > ");
  }

  // ---------- highlight ----------
  function paintHl(e: Element) {
    const r = (e as HTMLElement).getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = `${r.left - 2}px`;
    hl.style.top = `${r.top - 2}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    (hl.querySelector(".tag") as HTMLElement).textContent = shortLabel(e);
  }
  function shortLabel(e: Element): string {
    const t = e.tagName.toLowerCase();
    const id = (e as HTMLElement).id ? `#${(e as HTMLElement).id}` : "";
    return `${t}${id}`;
  }

  // ---------- pick mode ----------
  function enterPick() {
    mode = "pick";
    loadSnapdom().catch(() => {}); // warm NGAY khi bắt đầu chọn — lúc gửi module đã sẵn
    fab.style.display = "none";
    hintbar = el("div", "hintbar");
    hintbar.innerHTML = `<span class="dot"></span><span>${T.hint}</span>`;
    const mine = sentNotes();
    if (mine.length > 0) {
      const my = el("button");
      my.textContent = `${T.myNotes} (${mine.length})`;
      my.addEventListener("click", (ev) => { ev.stopPropagation(); showMyNotes(); });
      hintbar.appendChild(my);
    }
    const x = el("button");
    x.textContent = T.cancel;
    x.addEventListener("click", exitAll);
    hintbar.appendChild(x);
    shadow.appendChild(hintbar);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true); // pointer = chuột + pen + touch-drag
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("click", onPick, true);       // tap mobile cũng bắn click
    document.addEventListener("keydown", onKey, true);
  }

  // #9 — kéo-khung: auto-snap trượt thì khoanh tay vùng muốn nói
  function onDown(ev: PointerEvent) {
    if (mode !== "pick") return;
    const raw = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!raw || raw === host || host.contains(raw)) return;
    dragStart = { x: ev.clientX, y: ev.clientY };
    dragging = false;
  }
  function onUp(ev: PointerEvent) {
    if (mode !== "pick" || !dragStart) return;
    const rect = {
      left: Math.min(dragStart.x, ev.clientX), top: Math.min(dragStart.y, ev.clientY),
      right: Math.max(dragStart.x, ev.clientX), bottom: Math.max(dragStart.y, ev.clientY),
    };
    const wasDrag = dragging;
    dragStart = null;
    dragging = false;
    rubber.style.display = "none";
    if (!wasDrag) return; // click thường → onPick lo
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 250);
    // chọn element BAO trọn khung (nới 8px); không có → element giao lớn nhất
    const cx = (rect.left + rect.right) / 2, cy = (rect.top + rect.bottom) / 2;
    const cands = (document.elementsFromPoint(cx, cy) as Element[]).filter((e) => e !== host && !host.contains(e));
    let pick: Element | null = null;
    for (const c of cands) {
      const b = (c as HTMLElement).getBoundingClientRect();
      if (b.left <= rect.left + 8 && b.top <= rect.top + 8 && b.right >= rect.right - 8 && b.bottom >= rect.bottom - 8) { pick = c; break; }
    }
    selected = snap(pick ?? cands[0] ?? document.body);
    openSheet();
  }
  function onKey(ev: KeyboardEvent) {
    if (ev.key === "Escape") exitAll();
  }
  function onMove(ev: PointerEvent) {
    if (mode !== "pick") return;
    if (dragStart) {
      const dx = Math.abs(ev.clientX - dragStart.x), dy = Math.abs(ev.clientY - dragStart.y);
      if (dragging || dx > 10 || dy > 10) {
        dragging = true;
        hl.style.display = "none";
        rubber.style.display = "block";
        rubber.style.left = `${Math.min(dragStart.x, ev.clientX)}px`;
        rubber.style.top = `${Math.min(dragStart.y, ev.clientY)}px`;
        rubber.style.width = `${dx}px`;
        rubber.style.height = `${dy}px`;
        return;
      }
    }
    const raw = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!raw || raw === host || host.contains(raw)) return;
    hovered = snap(raw);
    paintHl(hovered);
  }
  function onPick(ev: MouseEvent) {
    if (mode !== "pick" || suppressClick) return;
    const raw = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!raw || raw === host || host.contains(raw)) return;
    ev.preventDefault();
    ev.stopPropagation();
    selected = snap(raw);
    openSheet();
  }

  // ---------- compose ----------
  function openSheet() {
    mode = "compose";
    loadSnapdom().catch(() => {}); // warm CDN trong lúc người ta gõ — send đỡ chờ
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("click", onPick, true);
    hintbar?.remove();
    paintHl(selected!);
    sheet?.remove();
    sheet = el("div", "sheet");
    const r = (selected as HTMLElement).getBoundingClientRect();
    if (innerWidth < 480) {
      // mobile: bottom-sheet cố định, không đuổi theo phần tử (ngón tay + bàn phím ảo)
      sheet.classList.add("bottom");
    } else {
      const below = r.bottom + 12 + 260 < innerHeight;
      sheet.style.left = `${Math.max(12, Math.min(r.left, innerWidth - 352))}px`;
      if (below) sheet.style.top = `${r.bottom + 10}px`;
      else sheet.style.bottom = `${Math.max(12, innerHeight - r.top + 10)}px`;
    }
    sheet.innerHTML = `
      <p class="sel"><b>◉</b> ${escapeHtml(shortLabel(selected!))} · <span class="path">${escapeHtml(cssPath(selected!))}</span></p>
      <textarea placeholder="${T.placeholder}"></textarea>
      <button class="linky contact-toggle">${T.contact}</button>
      <div class="contact"><input class="i-name" placeholder="${T.name}"><input class="i-email" type="email" placeholder="${T.email}"></div>
      <p class="err" style="display:none"></p>
      <div class="row">
        <button class="btn b-bigger">${T.bigger}</button>
        <button class="btn primary b-send">${T.send}</button>
      </div>`;
    sheet.querySelector(".contact-toggle")!.addEventListener("click", () => {
      sheet!.querySelector(".contact")!.classList.toggle("open");
    });
    sheet.querySelector(".b-bigger")!.addEventListener("click", () => {
      selected = biggerArea(selected!);
      openSheet();
    });
    sheet.querySelector(".b-send")!.addEventListener("click", send);

    // #8: autofill danh tính từ lần gửi trước
    const idn = readJson<{ n?: string; e?: string }>(ID_KEY, {});
    if (idn.n) (sheet.querySelector(".i-name") as HTMLInputElement).value = idn.n;
    if (idn.e) (sheet.querySelector(".i-email") as HTMLInputElement).value = idn.e;

    // #9: chụp NGAY khi chọn (không đợi bấm gửi) → preview + nút bỏ ảnh
    const prev = el("div", "shotprev");
    prev.innerHTML = `<button aria-label="${T.removeShot}">✕</button><span class="cap">${T.shotCap}</span>`;
    sheet.appendChild(prev);
    shotRemoved = false;
    const target = selected as HTMLElement;
    pendingShot = captureShot(target);
    pendingShot.then((dataUrl) => {
      if (!dataUrl || !sheet || shotRemoved || selected !== target) return;
      const img = document.createElement("img");
      img.src = dataUrl;
      prev.insertBefore(img, prev.querySelector(".cap"));
      prev.classList.add("on");
    });
    prev.querySelector("button")!.addEventListener("click", () => {
      shotRemoved = true;
      prev.remove();
    });

    shadow.appendChild(sheet);
    (sheet.querySelector("textarea") as HTMLTextAreaElement).focus();
  }

  function showMyNotes() {
    panel?.remove();
    panel = el("div", "mypanel");
    const items = sentNotes();
    panel.innerHTML = `<button class="close">✕</button><h4>${T.myTitle} (${items.length})</h4>` +
      items.map((it) => `<div class="it">"${escapeHtml(it.c)}"<div class="st">✓ sent · ${new Date(it.t).toLocaleString()}</div></div>`).join("");
    panel.querySelector(".close")!.addEventListener("click", () => { panel?.remove(); panel = null; });
    shadow.appendChild(panel);
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // ---------- payload + send ----------
  const STYLE_KEYS = [
    "display","position","width","height","margin","padding","border","borderRadius",
    "color","backgroundColor","backgroundImage","fontSize","fontFamily","fontWeight",
    "lineHeight","textAlign","boxShadow","zIndex","overflow","opacity","gap","flexDirection",
  ] as const;

  // Chụp ĐÚNG phần tử — retry 2 nấc, nén khi quá cap, fail ghi lastShotErr (đo tỉ lệ)
  async function captureShot(e: HTMLElement): Promise<string | null> {
    lastShotErr = "";
    const r = e.getBoundingClientRect();
    const withTimeout = <T,>(p: Promise<T>, ms: number, tag: string): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(tag)), ms))]);
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    try {
      const sd = await withTimeout(loadSnapdom(), 6000, "load-timeout");
      const baseScale = Math.min(1.5, 900 / Math.max(r.width, 1));
      const attempts = [
        { scale: baseScale, quality: 0.8, timeout: 7000 },
        { scale: baseScale * 0.6, quality: 0.6, timeout: 7000 },
      ];
      for (const at of attempts) {
        try {
          const result: any = await withTimeout(sd(e, { scale: at.scale }), at.timeout, "capture-timeout");
          let q = at.quality;
          for (let i = 0; i < 3; i++) {
            const blob: Blob = await result.toBlob({ type: "webp", quality: q });
            const dataUrl = await blobToDataUrl(blob);
            if (dataUrl.startsWith("data:image/") && dataUrl.length < 700000) return dataUrl;
            q -= 0.2;
            if (q < 0.3) break;
          }
          lastShotErr = "oversize";
        } catch (err: any) {
          lastShotErr = String(err?.message ?? "capture-fail");
        }
      }
    } catch (err: any) {
      lastShotErr = String(err?.message ?? "load-fail");
    }
    return null;
  }

  async function send() {
    const ta = sheet!.querySelector("textarea") as HTMLTextAreaElement;
    const errEl = sheet!.querySelector(".err") as HTMLElement;
    const comment = ta.value.trim();
    if (!comment) {
      errEl.textContent = T.empty;
      errEl.style.display = "block";
      return;
    }
    const btn = sheet!.querySelector(".b-send") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = T.sending;

    const e = selected as HTMLElement;
    const cs = getComputedStyle(e);
    const styleObj: Record<string, string> = {};
    for (const k of STYLE_KEYS) styleObj[k] = cs[k as any] as string;
    const r = e.getBoundingClientRect();

    // #9: ảnh đã chụp từ lúc mở sheet (preview) — chỉ chờ nốt nếu chưa xong
    let screenshot: string | null = null;
    if (!shotRemoved && pendingShot) {
      try {
        screenshot = await Promise.race([
          pendingShot,
          new Promise<string | null>((res) => setTimeout(() => res(null), 8000)),
        ]);
      } catch { /* bỏ ảnh */ }
    }

    const payload = {
      widget_key: KEY,
      selector: cssPath(e),
      dom_html: e.outerHTML.slice(0, 64 * 1024),
      dom_text: ((e as HTMLElement).innerText || "").trim().slice(0, 400),
      computed_style: styleObj,
      position: { x: r.left, y: r.top, w: r.width, h: r.height, scrollX, scrollY },
      meta: {
        url: location.href,
        viewport: { w: innerWidth, h: innerHeight },
        dpr: devicePixelRatio,
        ua: navigator.userAgent,
        lang: LANG,
        ...(screenshot ? {} : { shot_error: shotRemoved ? "removed-by-user" : lastShotErr || "unknown" }), // đo tỉ lệ ảnh fail
      },
      comment,
      reporter_name: (sheet!.querySelector(".i-name") as HTMLInputElement).value.trim() || null,
      reporter_email: (sheet!.querySelector(".i-email") as HTMLInputElement).value.trim() || null,
      screenshot,
    };

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      // #8: lưu sổ + danh tính cho lần sau
      try {
        const trail = sentNotes();
        trail.unshift({ c: comment.slice(0, 90), t: Date.now() });
        localStorage.setItem(SENT_KEY, JSON.stringify(trail.slice(0, 15)));
        const nm = (sheet!.querySelector(".i-name") as HTMLInputElement).value.trim();
        const em = (sheet!.querySelector(".i-email") as HTMLInputElement).value.trim();
        if (nm || em) localStorage.setItem(ID_KEY, JSON.stringify({ n: nm, e: em }));
      } catch { /* localStorage bị chặn — kệ */ }
      exitAll();
      sentToast();
    } catch {
      btn.disabled = false;
      btn.textContent = T.send;
      errEl.textContent = T.failed;
      errEl.style.display = "block";
    }
  }

  // ---------- misc ----------
  function sentToast() {
    const t = el("div", "toast ok");
    t.textContent = T.sent;
    const again = el("button", "again");
    again.textContent = T.again;
    again.addEventListener("click", () => { t.remove(); enterPick(); });
    t.appendChild(again);
    shadow.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function toast(msg: string, ok = false) {
    const t = el("div", `toast${ok ? " ok" : ""}`);
    t.textContent = msg;
    shadow.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function exitAll() {
    mode = "idle";
    hovered = selected = null;
    pendingShot = null;
    dragStart = null;
    dragging = false;
    rubber.style.display = "none";
    panel?.remove();
    panel = null;
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("pointerup", onUp, true);
    hl.style.display = "none";
    hintbar?.remove();
    sheet?.remove();
    sheet = null;
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("click", onPick, true);
    document.removeEventListener("keydown", onKey, true);
    fab.style.display = "flex";
  }

  // SPA đổi route giữa chừng → huỷ selection + toast (ux-spec)
  function onRoute() {
    if (mode !== "idle") {
      exitAll();
      toast(T.routed);
    }
  }
  addEventListener("popstate", onRoute);
  for (const fn of ["pushState", "replaceState"] as const) {
    const orig = history[fn].bind(history);
    (history as any)[fn] = (...args: any[]) => {
      const out = orig(...(args as [any, string, string?]));
      onRoute();
      return out;
    };
  }
}
