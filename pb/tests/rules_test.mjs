// KryMark — test matrix quyền PocketBase (điều kiện go-live GĐ0, thay rls_test.sql)
// 4 verb × mọi collection org-scope × user A↔B + anon. FAIL = exit 1.
// Chạy: PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node pb/tests/rules_test.mjs
// Tự dọn: xoá 2 user test (cascade org/member qua hook KHÔNG tự xoá org — dọn tay cuối file).

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS;
const STAMP = Date.now();
let failures = 0;

async function api(path, method = "GET", body, token) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); failures++; }
}

// ---- setup: admin + 2 user (hook tự tạo org A/B) ----
const adm = await api("/api/collections/_superusers/auth-with-password", "POST", {
  identity: ADMIN_EMAIL, password: ADMIN_PASS,
});
if (!adm.json.token) { console.error("Không auth được superuser"); process.exit(1); }
const ADMIN = adm.json.token;

async function mkUser(tag) {
  const email = `${tag}-${STAMP}@test.krymark`;
  const create = await api("/api/collections/users/records", "POST", {
    email, password: "test-12345678", passwordConfirm: "test-12345678",
  });
  if (create.status !== 200) { console.error(`Signup ${tag} fail:`, create.json); process.exit(1); }
  const auth = await api("/api/collections/users/auth-with-password", "POST", {
    identity: email, password: "test-12345678",
  });
  return { id: create.json.id, token: auth.json.token, email };
}
const A = await mkUser("usera");
const B = await mkUser("userb");

// org của mỗi user (qua membership, đọc bằng token chính chủ)
async function myOrg(u) {
  const r = await api(`/api/collections/members/records?filter=${encodeURIComponent(`user="${u.id}"`)}`, "GET", null, u.token);
  return r.json.items?.[0]?.org;
}
const orgA = await myOrg(A);
const orgB = await myOrg(B);
ok(!!orgA && !!orgB, `hook signup tự tạo org (A=${orgA}, B=${orgB})`);
if (!orgA || !orgB) process.exit(1);

// seed mỗi org: project + note + snapshot + comment + invite (bằng ADMIN — giả lập service role)
async function seed(orgId, tag) {
  const p = await api("/api/collections/projects/records", "POST",
    { org: orgId, name: `proj-${tag}`, widget_key: `wk-${tag}-${STAMP}` }, ADMIN);
  const n = await api("/api/collections/notes/records", "POST",
    { project: p.json.id, status: "new", selector: `button.${tag}`, comment: `note ${tag}` }, ADMIN);
  const s = await api("/api/collections/note_snapshots/records", "POST",
    { note: n.json.id, dom_html: `<button class="${tag}">x</button>` }, ADMIN);
  const c = await api("/api/collections/comments/records", "POST",
    { note: n.json.id, author_type: "system", body: `cmt ${tag}` }, ADMIN);
  const i = await api("/api/collections/invites/records", "POST",
    { org: orgId, email: `x@${tag}.test`, role: "member", token: `tk-${tag}-${STAMP}` }, ADMIN);
  for (const [k, r] of Object.entries({ p, n, s, c, i }))
    if (r.status !== 200) { console.error(`Seed ${tag}.${k} fail:`, r.json); process.exit(1); }
  return { project: p.json.id, note: n.json.id, snapshot: s.json.id, comment: c.json.id, invite: i.json.id };
}
const dataA = await seed(orgA, "a");
const dataB = await seed(orgB, "b");

console.log("\n== SELECT cross-org (A soi B → phải 404/rỗng) ==");
for (const [col, rid] of [
  ["orgs", orgB], ["projects", dataB.project], ["notes", dataB.note],
  ["note_snapshots", dataB.snapshot], ["comments", dataB.comment], ["invites", dataB.invite],
]) {
  const r = await api(`/api/collections/${col}/records/${rid}`, "GET", null, A.token);
  ok(r.status === 404, `A view ${col}/B → ${r.status}`);
}
{
  const r = await api(`/api/collections/members/records?filter=${encodeURIComponent(`user="${B.id}"`)}`, "GET", null, A.token);
  ok(r.json.totalItems === 0, `A list members của B → 0 dòng`);
  const all = await api(`/api/collections/notes/records`, "GET", null, A.token);
  ok(all.json.items?.every((n) => n.id !== dataB.note), `A list notes không lẫn note B`);
}

console.log("\n== SELECT own-org (A soi A → phải thấy, chống khoá chính chủ) ==");
for (const [col, rid] of [
  ["orgs", orgA], ["projects", dataA.project], ["notes", dataA.note],
  ["note_snapshots", dataA.snapshot], ["comments", dataA.comment], ["invites", dataA.invite],
]) {
  const r = await api(`/api/collections/${col}/records/${rid}`, "GET", null, A.token);
  ok(r.status === 200, `A view ${col}/A → ${r.status}`);
}

console.log("\n== UPDATE cross-org (A sửa B → phải 404) ==");
for (const [col, rid, patch] of [
  ["projects", dataB.project, { name: "hacked" }],
  ["notes", dataB.note, { status: "resolved" }],
  ["comments", dataB.comment, { body: "hacked" }],
  ["invites", dataB.invite, { email: "hacked@x" }],
  ["note_snapshots", dataB.snapshot, { dom_html: "hacked" }],
  ["orgs", orgB, { name: "hacked" }],
]) {
  const r = await api(`/api/collections/${col}/records/${rid}`, "PATCH", patch, A.token);
  ok(r.status === 404 || r.status === 403, `A update ${col}/B → ${r.status}`);
}

console.log("\n== DELETE cross-org (A xoá B → phải 404/403) ==");
for (const [col, rid] of [
  ["comments", dataB.comment], ["invites", dataB.invite], ["projects", dataB.project],
  ["notes", dataB.note], ["note_snapshots", dataB.snapshot], ["orgs", orgB],
]) {
  const r = await api(`/api/collections/${col}/records/${rid}`, "DELETE", null, A.token);
  ok(r.status === 404 || r.status === 403, `A delete ${col}/B → ${r.status}`);
}

console.log("\n== CREATE cross-org (A chèn vào org/note B → phải 400/403/404) ==");
{
  let r = await api("/api/collections/projects/records", "POST", { org: orgB, name: "inject", widget_key: `inj-${STAMP}` }, A.token);
  ok(r.status >= 400, `A create project trong org B → ${r.status}`);
  r = await api("/api/collections/invites/records", "POST", { org: orgB, email: "i@x", role: "member", token: `inj2-${STAMP}` }, A.token);
  ok(r.status >= 400, `A create invite trong org B → ${r.status}`);
  r = await api("/api/collections/comments/records", "POST", { note: dataB.note, author_type: "member", author_user: A.id, body: "inject" }, A.token);
  ok(r.status >= 400, `A create comment vào note B → ${r.status}`);
  // notes/snapshots: createRule=null → CẢ note org mình cũng không tạo được từ client (chỉ /api/report)
  r = await api("/api/collections/notes/records", "POST", { project: dataA.project, status: "new", selector: "x", comment: "client inject" }, A.token);
  ok(r.status >= 400, `A create note trực tiếp (dù org mình) → ${r.status} (D1: chỉ server)`);
  r = await api("/api/collections/note_snapshots/records", "POST", { note: dataA.note, dom_html: "inject" }, A.token);
  ok(r.status >= 400, `A create snapshot trực tiếp → ${r.status}`);
}

console.log("\n== UPDATE own-org (A đổi status note A → phải được) ==");
{
  const r = await api(`/api/collections/notes/records/${dataA.note}`, "PATCH", { status: "in_progress" }, A.token);
  ok(r.status === 200, `A update notes/A → ${r.status}`);
  // soft-delete rồi list phải ẩn
  const d = await api(`/api/collections/notes/records/${dataA.note}`, "PATCH", { deleted: new Date().toISOString() }, A.token);
  ok(d.status === 200, `A soft-delete note A → ${d.status}`);
  const after = await api(`/api/collections/notes/records/${dataA.note}`, "GET", null, A.token);
  ok(after.status === 404, `note đã soft-delete ẩn khỏi view → ${after.status}`);
  // D10' (0.12.2): org member ĐƯỢC hard-delete chủ động (Hide vẫn là default mềm)
  const hard = await api(`/api/collections/notes/records/${dataA.note}`, "DELETE", null, A.token);
  ok(hard.status === 204, `hard-delete org mình được phép (D10') → ${hard.status}`);
}

console.log("\n== ANON (không token → không thấy/ghi gì) ==");
for (const col of ["orgs", "projects", "notes", "note_snapshots", "comments", "invites", "members"]) {
  const r = await api(`/api/collections/${col}/records`);
  ok(r.status >= 400 || r.json.totalItems === 0, `anon list ${col} → ${r.status}/${r.json.totalItems ?? "?"}`);
}
{
  const r = await api("/api/collections/notes/records", "POST", { project: dataA.project, status: "new", selector: "x", comment: "anon inject" });
  ok(r.status >= 400, `anon create note → ${r.status}`);
}

// ---- dọn: xoá record test (ADMIN) ----
for (const [col, rid] of [
  ["orgs", orgA], ["orgs", orgB], // cascade members/projects/notes/snapshots/comments/invites
]) await api(`/api/collections/${col}/records/${rid}`, "DELETE", null, ADMIN);
for (const u of [A, B]) await api(`/api/collections/users/records/${u.id}`, "DELETE", null, ADMIN);

console.log(failures === 0
  ? "\n✅ RULES MATRIX PASS — cô lập org kín cả 4 verb + anon khoá"
  : `\n❌ ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
