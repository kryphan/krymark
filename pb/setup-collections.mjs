// KryMark — tạo/cập nhật 6 collection PocketBase + API rules đa-tenant.
// Idempotent: chạy lại chỉ update. Thay cho migration Supabase (DECISIONS D14).
// Chạy: PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASS=... node pb/setup-collections.mjs
//
// Mô hình quyền (thay RLS): mọi rule đi qua back-relation members_via_org →
// user chỉ thấy/đụng record thuộc org mình. anon (auth.id = "") không match rule nào.
// notes/note_snapshots create = null → CHỈ superuser token (/api/report, D1).

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASS = process.env.PB_ADMIN_PASS;
if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error("Thiếu PB_ADMIN_EMAIL / PB_ADMIN_PASS");
  process.exit(1);
}

async function api(path, method = "GET", body, token) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ---- auth superuser ----
const auth = await api("/api/collections/_superusers/auth-with-password", "POST", {
  identity: ADMIN_EMAIL,
  password: ADMIN_PASS,
});
const TOKEN = auth.token;

// ---- helpers ----
const existing = new Map();
{
  const list = await api("/api/collections?perPage=200", "GET", null, TOKEN);
  for (const c of list.items) existing.set(c.name, c);
}

async function upsertCollection(def) {
  const found = existing.get(def.name);
  if (found) {
    const updated = await api(`/api/collections/${found.id}`, "PATCH", def, TOKEN);
    existing.set(def.name, updated);
    console.log(`~ update ${def.name}`);
    return updated;
  }
  const created = await api("/api/collections", "POST", def, TOKEN);
  existing.set(def.name, created);
  console.log(`+ create ${def.name}`);
  return created;
}

const id = (name) => {
  const c = existing.get(name);
  if (!c) throw new Error(`collection ${name} chưa tồn tại`);
  return c.id;
};

const text = (name, opts = {}) => ({ name, type: "text", ...opts });
const rel = (name, collectionId, opts = {}) => ({
  name, type: "relation", collectionId, maxSelect: 1, cascadeDelete: opts.cascade ?? false,
  required: opts.required ?? false,
});
const date = (name) => ({ name, type: "date" });
const json = (name) => ({ name, type: "json", maxSize: 200000 });
const autodate = (name, onCreate, onUpdate) => ({ name, type: "autodate", onCreate, onUpdate });

// Điều kiện "user hiện tại thuộc org X" — dùng lại trong mọi rule
const IN_ORG = (orgPath) => `@request.auth.id != "" && ${orgPath}.members_via_org.user ?= @request.auth.id`;

// ---- PASS 1: tạo khung (chưa rules/relation chéo) ----
await upsertCollection({ name: "orgs", type: "base", fields: [
  text("name", { required: true }),
  text("plan", { required: true }),                    // D6: free/paid để sẵn
  text("api_key"),                                     // MCP/CLI access (km_live_…) — 0.13.0
  autodate("created", true, false),
]});
await upsertCollection({ name: "members", type: "base", fields: [
  rel("org", id("orgs"), { required: true, cascade: true }),
  rel("user", "_pb_users_auth_", { required: true, cascade: true }),
  text("role", { required: true }),                    // owner|admin|member (validate app-side)
  autodate("created", true, false),
]});
await upsertCollection({ name: "invites", type: "base", fields: [
  rel("org", id("orgs"), { required: true, cascade: true }),
  text("email", { required: true }),
  text("role", { required: true }),
  text("token", { required: true }),
  date("expires"),
  autodate("created", true, false),
]});
await upsertCollection({ name: "projects", type: "base", fields: [
  rel("org", id("orgs"), { required: true, cascade: true }),
  text("name", { required: true }),
  text("widget_key", { required: true }),
  json("domains"),                                     // D3': origin check = lớp UX
  text("default_lang"),
  text("webhook_url"),                                 // outbound webhook (n8n/Slack/ClickUp…) — 1.3.0
  text("webhook_secret"),                              // HMAC ký payload
  json("settings"),
  autodate("created", true, false),
]});
await upsertCollection({ name: "notes", type: "base", fields: [
  rel("project", id("projects"), { required: true, cascade: true }),
  text("status", { required: true }),                  // new|spam|in_progress|resolved
  text("selector", { required: true }),
  text("dom_text"),
  text("comment", { required: true, max: 5000 }),
  json("meta"),
  text("reporter_email"),
  text("reporter_name"),
  text("clickup_task_id"),                             // GĐ3b
  date("reporter_emailed_at"),                         // D5
  rel("status_changed_by", "_pb_users_auth_"),
  date("status_changed_at"),
  date("deleted"),                                     // D10: soft-delete
  json("tags"),                                        // AI auto-tag (heuristic v1), dashboard sửa được
  autodate("created", true, false),
]});
await upsertCollection({ name: "note_snapshots", type: "base", fields: [
  rel("note", id("notes"), { required: true, cascade: true }),
  text("dom_html", { required: true, max: 70000 }),    // D11: server cắt 64KB trước
  json("computed_style"),
  json("position"),
  { name: "screenshot", type: "file", maxSelect: 1, maxSize: 1000000,
    mimeTypes: ["image/webp", "image/png", "image/jpeg"] },  // best-effort (C10: cap 1MB) — fallback khi S3 fail
  text("screenshot_url"),                              // S3 public — đính vào AI prompt (2026-07-17)
]});
await upsertCollection({ name: "comments", type: "base", fields: [
  rel("note", id("notes"), { required: true, cascade: true }),
  text("author_type", { required: true }),             // member|system
  rel("author_user", "_pb_users_auth_"),
  text("body", { required: true }),
  autodate("created", true, false),
]});

// ---- PASS 2: unique index + API rules ----
await upsertCollection({
  name: "orgs", type: "base",
  fields: existing.get("orgs").fields,
  listRule: `@request.auth.id != "" && members_via_org.user ?= @request.auth.id`,
  viewRule: `@request.auth.id != "" && members_via_org.user ?= @request.auth.id`,
  createRule: null, updateRule: null, deleteRule: null,   // org tạo qua hook signup; sửa/xoá = server
});
await upsertCollection({
  name: "members", type: "base",
  fields: existing.get("members").fields,
  indexes: [`CREATE UNIQUE INDEX idx_members_org_user ON members (org, user)`],
  listRule: `user = @request.auth.id`,
  viewRule: `user = @request.auth.id`,
  createRule: null, updateRule: null, deleteRule: null,   // hook signup / accept-invite server-side
});
await upsertCollection({
  name: "invites", type: "base",
  fields: existing.get("invites").fields,
  indexes: [`CREATE UNIQUE INDEX idx_invites_token ON invites (token)`],
  listRule: IN_ORG("org"), viewRule: IN_ORG("org"),
  createRule: IN_ORG("org"), updateRule: IN_ORG("org"), deleteRule: IN_ORG("org"),
});
await upsertCollection({
  name: "projects", type: "base",
  fields: existing.get("projects").fields,
  indexes: [`CREATE UNIQUE INDEX idx_projects_widget_key ON projects (widget_key)`],
  listRule: IN_ORG("org"), viewRule: IN_ORG("org"),
  createRule: IN_ORG("org"), updateRule: IN_ORG("org"), deleteRule: IN_ORG("org"),
});
await upsertCollection({
  name: "notes", type: "base",
  fields: existing.get("notes").fields,
  indexes: [`CREATE INDEX idx_notes_hot ON notes (project, status, created)`],
  listRule: `${IN_ORG("project.org")} && deleted = null`,   // soft-deleted ẩn khỏi dashboard
  viewRule: `${IN_ORG("project.org")} && deleted = null`,
  createRule: null,                                        // D1: chỉ /api/report (superuser token)
  updateRule: IN_ORG("project.org"),                       // đổi status / soft-delete
  deleteRule: IN_ORG("project.org"),                       // D10' (17/07): hard-delete chủ động, Hide vẫn là default
});
await upsertCollection({
  name: "note_snapshots", type: "base",
  fields: existing.get("note_snapshots").fields,
  indexes: [`CREATE UNIQUE INDEX idx_snapshots_note ON note_snapshots (note)`],
  listRule: IN_ORG("note.project.org"), viewRule: IN_ORG("note.project.org"),
  createRule: null, updateRule: null, deleteRule: null,    // chỉ server ghi
});
await upsertCollection({
  name: "comments", type: "base",
  fields: existing.get("comments").fields,
  listRule: IN_ORG("note.project.org"), viewRule: IN_ORG("note.project.org"),
  createRule: `${IN_ORG("note.project.org")} && author_user = @request.auth.id`,
  updateRule: `author_user = @request.auth.id`,
  deleteRule: `author_user = @request.auth.id`,
});

// password_resets — flow quên mật khẩu TỰ LÀM qua SES API (PB SMTP cần port 2587 chưa test
// từ SYD1, và trang reset mặc định của PB nằm trên admin UI internal). ADMIN-ONLY: 0 rule.
await upsertCollection({ name: "password_resets", type: "base", fields: [
  text("email", { required: true }),
  text("token", { required: true }),
  date("expires"),
  autodate("created", true, false),
]});
await upsertCollection({
  name: "password_resets", type: "base",
  fields: existing.get("password_resets").fields,
  indexes: [`CREATE UNIQUE INDEX idx_pwreset_token ON password_resets (token)`],
  listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
});

console.log("✅ setup-collections xong — 8 collection (users built-in) + rules đa-tenant");
