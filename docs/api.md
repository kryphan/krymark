# HTTP API

Four public endpoints. Everything else is the dashboard's own server actions.

## POST `/api/report` — submit feedback (anonymous)

Called by the widget; you can call it from anything (custom widgets, native apps).

**CORS:** open (`*`). Preflight supported. **Auth:** none — the `widget_key` identifies the project; abuse is contained by rate limits.

```jsonc
{
  "widget_key": "…",              // required — from the project page
  "selector": "css > path",       // required
  "comment": "what they said",    // required, ≤5000 chars
  "dom_html": "<button>…</button>",  // capped server-side at 64KB
  "dom_text": "…",                // ≤400 chars
  "computed_style": {…},
  "position": {"x":0,"y":0,"w":0,"h":0,"scrollX":0,"scrollY":0},
  "meta": {"url":"…","viewport":{"w":0,"h":0},"dpr":2,"ua":"…"},
  "reporter_name": "…",           // optional
  "reporter_email": "…",          // optional — enables resolve emails
  "screenshot": "data:image/webp;base64,…"  // optional, ≤1MB decoded
}
```

**Pipeline:** IP rate limit → body-size cap (900KB) → project lookup → origin allow-list check → per-project daily cap → insert note + snapshot → screenshot to S3 (or PocketBase fallback) → auto-tag classification.

| Status | Meaning |
|---|---|
| `200 {ok:true, note_id}` | stored |
| `400` | missing/invalid fields |
| `403` | project has a domain allow-list and the `Origin` doesn't match (suffix match; UX guard — not a security boundary) |
| `404` | unknown `widget_key` |
| `413` | body over 900KB |
| `429` | rate limited (default 10/IP/min, 500/project/day — tune via env) |

## GET `/api/shot/:noteId` — screenshot (authenticated)

Dashboard session required; access checked through the org rules. Redirects (302) to the S3 URL when the image lives there, otherwise streams the PocketBase file.

## GET `/api/health`

`{ok, app, pb}` — 200 when PocketBase answers, **503 when it doesn't**. For uptime monitors.

## GET/POST `/api/rr` — reporter re-review (signed links)

Used by the links in resolve emails (`?t=<noteId>.<hmac>&ok=1|0`). `ok=1` records a 👍 confirmation comment; `ok=0` renders a tiny form whose POST reopens the note (`in_progress`), adds a 🔁 comment and fires the Telegram ping. Tokens are HMAC-signed with `IP_HASH_SALT` — no login, not guessable, no extra table.

## MCP `/api/mcp`

JSON-RPC over HTTP with an org API key — see [mcp.md](mcp.md). Being plain HTTP, it doubles as the "CLI" API:

```bash
curl -s https://YOUR-KRYMARK/api/mcp \
  -H "Authorization: Bearer km_live_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_notes","arguments":{"status":"new"}}}'
```
