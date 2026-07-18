# Outbound webhooks

Each project can POST its note events to any URL — wire KryMark into n8n, Zapier, Slack (via an incoming-webhook proxy), ClickUp, Discord, your own service. No per-integration code.

## Setup

**Project → Settings → Webhook URL** (+ optional secret). Hit **Send test event** to fire a sample immediately.

## Events

| Event | Fires when |
|---|---|
| `note.created` | new note (widget, bookmarklet, extension, or an AI agent via `submit_note`) |
| `note.resolved` | note marked resolved (dashboard, bulk, or MCP) |
| `note.status_changed` | status changed to something other than resolved |

## Payload

`POST` with `Content-Type: application/json`:

```json
{
  "event": "note.created",
  "sent_at": "2026-07-18T…Z",
  "project": { "id": "…", "name": "My Site" },
  "note": {
    "id": "…",
    "comment": "the feedback text",
    "selector": "button.cta",
    "status": "new",
    "tags": ["color-style"],
    "page_url": "https://mysite.com/pricing",
    "reporter_name": "Anna",
    "dashboard_url": "https://YOUR-KRYMARK/p/…/n/…"
  }
}
```

Headers: `X-KryMark-Event: <event>`, and when a secret is set, `X-KryMark-Signature: sha256=<hex>` — HMAC-SHA256 of the raw body with your secret.

## Verify the signature (Node)

```js
import { createHmac } from "crypto";
const expected = "sha256=" + createHmac("sha256", SECRET).update(rawBody).digest("hex");
if (req.headers["x-krymark-signature"] !== expected) return res.status(401).end();
```

Delivery is fire-and-forget (5s timeout, no retries) — build any critical automation to be idempotent on `note.id`.
