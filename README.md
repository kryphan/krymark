# ◉ KryMark

**Feedback on vibecoded websites that becomes an AI prompt — or gets pulled straight into your AI editor via MCP.**

🔗 **[Live showcase](https://kryphan.github.io/krymark/)** · [Docs](docs/) · [Self-hosting](docs/self-hosting.md)

You built a site with Lovable, Bolt, v0 or Cursor. Now the review round is chat screenshots and "make it pop". KryMark gives non-coders a way to click the exact element and say what they want — and gives you (or your AI agent) a DOM-rich, paste-ready fix prompt.

```
[reviewer on your site]                [you / your AI]
  click element → type feedback   →    dashboard · fix prompt · MCP tools
  (one script tag, no login)           screenshot + DOM + styles included
```

## Features

- **Embed widget** — one `<script>` tag, ~6KB gzip, Shadow DOM, no SDK. Reviewers click (or drag-select) an element, type in any language, hit send. Screenshot preview with a remove button; a "My notes" trail so they know what they've sent.
- **Frozen snapshots** — every note stores the element's `outerHTML`, computed styles, position, page meta and a screenshot at report time. Selectors drift after rebuilds; snapshots don't.
- **AI fix prompts** — one note or a batch ("fix session") compiled into a single numbered prompt engineered for Cursor / Lovable / Claude: match by text & structure, smallest change, reconcile duplicates, flag what you can't find.
- **MCP server built in** — point Claude Code / Cursor at `/api/mcp` with an API key and the AI pulls feedback, fixes it, and resolves notes end-to-end. Six tools: `list_projects`, `list_notes`, `get_fix_prompt`, `resolve_notes`, `set_status`, `add_comment`.
- **Dashboard** — dense dark UI: list / cards / kanban board (drag to change status), auto-tagging (layout / copy / style / bug / missing), filters, page grouping, duplicate clustering, bulk actions, team comments.
- **Closed loop** — resolving emails the reporter (one consolidated email per person) with *"Fixed the way you wanted?"* links; a "not quite" reply reopens the note.
- **Multi-tenant** — orgs, projects, invites, roles, per-org API keys. PocketBase API rules enforce isolation.
- **Anti-spam by default** — IP-hash rate limiting + per-project daily caps on the public report endpoint. Origin allow-list per project as a UX layer.

## Quickstart (Docker)

```bash
git clone https://github.com/kryphan/krymark && cd krymark
cp .env.example .env            # fill in NEXT_PUBLIC_APP_ORIGIN + IP_HASH_SALT
docker compose up -d --build

# 1) create the PocketBase superuser
docker exec krymark-pb /pb/pocketbase superuser upsert admin@example.com YOUR_PASSWORD --dir /pb/pb_data

# 2) create collections + multi-tenant rules (idempotent — rerun after upgrades)
PB_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASS=YOUR_PASSWORD npm run setup

# 3) generate the app's superuser token → put it in .env as PB_SUPERUSER_TOKEN
PB_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASS=YOUR_PASSWORD node pb/gen-superuser-token.mjs

docker compose up -d app        # restart app with the token
```

Open `http://localhost:3000` → sign up (your org is created automatically) → create a project → paste the snippet on any site:

```html
<script src="https://your-krymark.example.com/w.js" data-key="YOUR_WIDGET_KEY" defer></script>
```

## AI access (MCP)

Dashboard → **Team → AI access** → copy the config block into `.mcp.json` (Claude Code) or your editor's MCP settings:

```json
{
  "mcpServers": {
    "krymark": {
      "type": "http",
      "url": "https://your-krymark.example.com/api/mcp",
      "headers": { "Authorization": "Bearer km_live_YOUR_KEY" }
    }
  }
}
```

Then just ask: *"Pull my new KryMark feedback and fix all of it, then resolve the notes."*

## Docs

- [Self-hosting guide](docs/self-hosting.md) — install, reverse proxy, backups, upgrades, troubleshooting
- [The widget](docs/widget.md) — behavior, captures, screenshots, per-platform install, CSP
- [HTTP API](docs/api.md) — `/api/report` contract, health, re-review links
- [MCP](docs/mcp.md) — AI editor setup, tools, raw JSON-RPC usage
- [Webhooks](docs/webhooks.md) — outbound note events → any URL (n8n / Slack / ClickUp)
- [Architecture](docs/architecture.md) — components, data model, multi-tenancy, design decisions
- [Contributing](CONTRIBUTING.md)

## Configuration

Everything optional degrades gracefully — see [`.env.example`](.env.example) for the full reference.

| Block | Needed for | Without it |
|---|---|---|
| `NEXT_PUBLIC_APP_ORIGIN`, `PB_SUPERUSER_TOKEN`, `IP_HASH_SALT` | core | required |
| `S3_*` | screenshots on public URLs (embedded in AI prompts) | screenshots stored in PocketBase, proxied by the app |
| `SES_*` | resolve/reset emails + the reporter re-review loop | emails silently skipped |
| `TG_BOT_TOKEN`, `TG_CHAT_ID` | Telegram ping on new notes | no pings |

## Architecture

- **Next.js 16** — dashboard, public APIs (`/api/report`, `/api/mcp`, `/api/rr`), serves the widget (`/w.js`) and the self-hosted capture library (`/vendor/snapdom.mjs`).
- **PocketBase** — auth, SQLite storage, multi-tenant API rules. Internal-only: the widget never talks to it directly; the admin UI binds to localhost.
- **Widget** — vanilla TS IIFE. Screenshots via [snapdom](https://github.com/zumerlab/snapdom) (self-hosted, CDN fallback, 2-stage retry + re-compression).

Ops extras: `/api/health` (app + PocketBase, returns 503 when the DB is down), `ops/backup-pb.sh` (daily PocketBase backup via API, keeps 7), `deploy.sh` (optional git-push deploy — see `deploy.env.example`).

## Development

```bash
npm install
# run PocketBase locally: download from pocketbase.io, then
./pocketbase serve --dir ./pb_data --hooksDir ./pb/pb_hooks
npm run setup       # against http://127.0.0.1:8090
npm run dev
```

`npm run build` bundles the widget (esbuild) and builds Next. `npm run typecheck` before PRs.

## License

[MIT](LICENSE) © KryPhan
