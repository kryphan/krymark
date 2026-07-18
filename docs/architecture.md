# Architecture

## Components

```
 customer site                     your KryMark instance
┌───────────────┐   POST /api/report   ┌─────────────────────────┐
│  w.js widget  │ ───────────────────► │  Next.js app             │
│  (Shadow DOM) │                      │  · dashboard (SSR)       │
└───────────────┘                      │  · /api/report /rr /mcp  │
                                       │  · serves w.js + snapdom │
 AI editor (Claude Code/Cursor)        └───────────┬─────────────┘
        │  JSON-RPC /api/mcp                       │ HTTP (internal only)
        └──────────────────────────────►  ┌────────▼────────┐
                                           │   PocketBase    │
 reporter email ◄── SES (optional)         │  auth + SQLite  │
 screenshots    ◄── S3  (optional)         └─────────────────┘
```

**Load-bearing decisions**

1. **The widget never touches the database.** It POSTs to `/api/report`; the server validates, rate-limits and writes with a superuser token. The `widget_key` is an identifier, not a credential.
2. **A note is a frozen snapshot, not a live pointer.** Selectors break the moment the vibecoder rebuilds; `outerHTML` + styles + screenshot captured at report time stay true. Duplicate clustering is computed at render time for the same reason.
3. **Origin allow-lists are UX, not security.** `Origin` headers are forgeable and *.lovable.app is a shared domain. The real shield is IP-hash rate limiting + per-project daily caps, on from day one.
4. **PocketBase stays internal.** Dashboard reads go through per-user auth + API rules; anonymous writes go through the app only. The admin UI binds to localhost.
5. **Optional services degrade, never block.** No S3 → screenshots in PocketBase. No SES → no emails, everything else identical. No Telegram → no pings.

## Data model (PocketBase collections)

```
orgs        (name, plan, api_key)
members     (org→, user→, role)          unique(org,user)
invites     (org→, email, role, token, expires)
projects    (org→, name, widget_key uq, domains[], settings)
notes       (project→, status, selector, dom_text, comment, meta,
             tags[], reporter_name/email, reporter_emailed_at,
             status_changed_by/at, deleted)          idx(project,status,created)
note_snapshots (note→ 1:1, dom_html ≤64KB, computed_style,
                position, screenshot file, screenshot_url)
comments    (note→, author_type member|system, author_user→, body)
password_resets (email, token uq, expires)           admin-only
```

`note_snapshots` is split from `notes` on purpose: `dom_html` can be hundreds of KB and the note list is the hottest query — the list reads `notes` only, the blob loads on detail view.

**Statuses:** `new → in_progress → resolved` (+`spam`). Deletion is soft (`deleted` timestamp) by default; explicit "Delete forever" cascades the snapshot, comments and the S3 object.

## Multi-tenancy

Every collection carries an org scope, enforced by PocketBase API rules through the back-relation `members_via_org`:

```
@request.auth.id != "" && project.org.members_via_org.user ?= @request.auth.id
```

Anonymous users match no rule (locked out). Server-side privileged paths (`/api/report`, MCP, invite acceptance) use the superuser token **after** their own scope check — MCP filters every query by the API key's org.

The rules matrix test (`pb/tests/rules_test.mjs`) asserts isolation across 4 verbs × all org-scoped collections × two orgs + anonymous, and is the go-live gate: run it against your instance any time.

## The prompt engine (`src/lib/prompt.ts`)

Single-note and batch prompts share the same principles: match by **text and structure** first (selectors drift), smallest change that satisfies the intent, keep the design system, fix shared components once, flag what can't be found instead of guessing. HTML is noise-stripped (svg innards, base64 URIs, long data-attributes) and length-capped per item. Screenshot URLs are embedded when stored on S3 so vision models can look.

## Auto-tagging (`src/lib/tags.ts`)

A zero-dependency regex classifier (English + Vietnamese) buckets each incoming note into layout / copy / style / bug / missing / other. Deliberately server-side and editable in the dashboard — reporters are never asked to categorize (friction stays zero). Swap in an LLM call behind the same function if you need better recall.
