# MCP — let your AI editor work the feedback queue

KryMark ships a remote MCP server at `/api/mcp` (JSON-RPC 2.0 over plain HTTP POST — the Streamable HTTP transport). Claude Code, Cursor and any MCP-capable client can pull feedback, build fix prompts and resolve notes without copy-paste.

## Setup

Get the org API key from **Dashboard → Team → AI access** (format `km_live_…`, regenerate any time — old key dies instantly).

**Claude Code** — `.mcp.json` in your site's repo:

```json
{
  "mcpServers": {
    "krymark": {
      "type": "http",
      "url": "https://YOUR-KRYMARK/api/mcp",
      "headers": { "Authorization": "Bearer km_live_YOUR_KEY" }
    }
  }
}
```

**Cursor** — Settings → MCP → Add server, same URL + header.

Then ask the agent: *"Pull my new KryMark feedback and fix all of it, then resolve the notes."*

## Tools

| Tool | Args | Does |
|---|---|---|
| `list_projects` | — | Projects with note counts by status |
| `create_project` | `name`, `default_lang?` | Create a project; returns widget_key + embed/review links |
| `list_notes` | `project_id?`, `status?` (new/in_progress/resolved/spam), `tag?` (ui-layout/text-copy/color-style/bug/missing/other), `limit?` | Compact note list; response includes the suggested next step |
| `get_fix_prompt` | `note_ids[]` (1–20) | Full fix prompt: verbatim feedback, CSS path, element text, trimmed frozen HTML, key styles, screenshot URL (when on S3), workflow instructions. Ends with the exact `resolve_notes` call to make when done |
| `resolve_notes` | `note_ids[]`, `send_email?` (default true) | Marks resolved; sends **one consolidated email per reporter** with re-review links |
| `set_status` | `note_ids[]`, `status` (new/in_progress/spam) | Triage without resolving |
| `submit_note` | `project_id`, `comment`, `page_url?`, `selector?`, `tag?`, `reporter?` | **AI files a new note** — for agents that QA sites and want findings in the queue (no DOM snapshot; auto-tagged) |
| `add_comment` | `note_id`, `body` | Team-visible comment, stamped `[via AI/MCP]` |

The typical loop the server's `instructions` field teaches the client:

```
list_notes(status="new") → get_fix_prompt(note_ids) → apply fixes → resolve_notes(note_ids)
```

**QA loop** (agent as reporter): while reviewing a site, call `submit_note` for each finding — they land in the same queue as human feedback, tagged and Telegram-notified, ready for the fix loop above.

## Security model

- The key is **org-scoped**: every tool call is filtered to the key's org server-side. A key can never see another org's data; a wrong key gets `401`.
- Treat it like any secret: it can read feedback, change statuses and trigger reporter emails. Rotate from Team → AI access.
- Transport is plain HTTPS; no cookies, no OAuth dance — works headless and in CI.

## Raw JSON-RPC (curl / scripts)

The MCP endpoint is just HTTP, so any script can use it:

```bash
KEY=km_live_YOUR_KEY; URL=https://YOUR-KRYMARK/api/mcp
call () { curl -s "$URL" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$1"; }

call '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
call '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_notes","arguments":{"status":"new","limit":10}}}'
call '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_fix_prompt","arguments":{"note_ids":["NOTE_ID"]}}}'
```

Supported methods: `initialize`, `ping`, `tools/list`, `tools/call` (plus notifications, acknowledged with 202). SSE streaming is not used — pure request/response.
