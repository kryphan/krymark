// MCP tools — AI (Claude Code/Cursor) tự kéo feedback về sửa, không cần copy-paste.
// Auth = org api_key (km_live_…) → mọi query đi ADMIN client nhưng SCOPE CỨNG theo org
// (cùng pattern /api/report: server-side validate rồi mới đụng data).
import { randomBytes } from "crypto";
import { pbAdmin } from "@/lib/pb-admin";
import { buildBatchPrompt, buildPrompt } from "@/lib/prompt";
import { sendBatchResolvedEmail } from "@/lib/email";
import { TAGS, classifyNote } from "@/lib/tags";
import { notifyTelegram } from "@/lib/notify";
import { appOrigin } from "@/lib/origin";
import { fireWebhook } from "@/lib/webhook";

export async function orgFromApiKey(key: string): Promise<{ id: string; name: string } | null> {
  if (!/^km_live_[a-f0-9]{32}$/.test(key)) return null;
  try {
    const org = await pbAdmin().collection("orgs").getFirstListItem(`api_key="${key}"`);
    return { id: org.id, name: org.name };
  } catch {
    return null;
  }
}

const clean = (s: string) => s.replace(/[^a-z0-9]/gi, "");

export const TOOL_DEFS = [
  {
    name: "list_projects",
    description: "List the org's KryMark projects (sites collecting feedback) with note counts by status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_notes",
    description:
      "List feedback notes. Each note = one piece of end-user feedback anchored to a DOM element. Filter by project, status (new|in_progress|resolved|spam) or tag (ui-layout|text-copy|color-style|bug|missing|other).",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project id (from list_projects). Omit = all projects." },
        status: { type: "string", enum: ["new", "in_progress", "resolved", "spam"] },
        tag: { type: "string", enum: Object.keys(TAGS) },
        limit: { type: "number", description: "Max notes (default 30)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_fix_prompt",
    description:
      "Build the full AI fix prompt for one or more notes (DOM snapshot, styles, screenshot URL, instructions). Paste-ready; follow it to fix the site, then call resolve_notes.",
    inputSchema: {
      type: "object",
      properties: { note_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 } },
      required: ["note_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "resolve_notes",
    description:
      "Mark notes as resolved after fixing. Sends ONE consolidated email per reporter (skip with send_email=false).",
    inputSchema: {
      type: "object",
      properties: {
        note_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
        send_email: { type: "boolean", description: "Default true" },
      },
      required: ["note_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "set_status",
    description: "Set status for notes (new|in_progress|spam). Use resolve_notes for resolved.",
    inputSchema: {
      type: "object",
      properties: {
        note_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
        status: { type: "string", enum: ["new", "in_progress", "spam"] },
      },
      required: ["note_ids", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "create_project",
    description:
      "Create a new project (a site to collect feedback on) in this org. Returns its widget_key and the embed/review links.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        default_lang: { type: "string", enum: ["en", "vi"], description: "Widget language (default en)" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_note",
    description:
      "File a NEW feedback note as an AI agent (e.g. while QA-ing a site). Use when YOU find an issue — human reviewers use the embed widget instead. No DOM snapshot is stored; describe the element in the comment and selector.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "From list_projects" },
        comment: { type: "string", maxLength: 5000, description: "What's wrong / what should change" },
        page_url: { type: "string", description: "Page where the issue lives" },
        selector: { type: "string", description: "CSS selector or human description of the element (optional)" },
        tag: { type: "string", enum: Object.keys(TAGS), description: "Omit to auto-classify" },
        reporter: { type: "string", description: "Agent name shown in the dashboard (default: AI agent)" },
      },
      required: ["project_id", "comment"],
      additionalProperties: false,
    },
  },
  {
    name: "add_comment",
    description: "Add an internal team comment on a note (e.g. what was changed, or why it was skipped).",
    inputSchema: {
      type: "object",
      properties: { note_id: { type: "string" }, body: { type: "string", maxLength: 2000 } },
      required: ["note_id", "body"],
      additionalProperties: false,
    },
  },
];

// Lấy notes trong org theo ids — LUÔN kèm điều kiện project.org (scope cứng)
async function orgNotes(orgId: string, ids: string[]) {
  const pb = pbAdmin();
  const f = `project.org="${clean(orgId)}" && (${ids.slice(0, 20).map((i) => `id="${clean(i)}"`).join(" || ")})`;
  return pb.collection("notes").getFullList({ filter: f });
}

export async function callTool(org: { id: string; name: string }, name: string, args: Record<string, unknown>): Promise<string> {
  const pb = pbAdmin();

  if (name === "list_projects") {
    const projects = await pb.collection("projects").getFullList({ filter: `org="${clean(org.id)}"` });
    const out = [];
    for (const p of projects) {
      const notes = await pb.collection("notes").getFullList({ filter: `project="${p.id}" && deleted=null`, fields: "id,status" });
      const by: Record<string, number> = {};
      for (const n of notes) by[n.status] = (by[n.status] ?? 0) + 1;
      out.push({ id: p.id, name: p.name, widget_key: p.widget_key, notes_total: notes.length, by_status: by });
    }
    return JSON.stringify({ org: org.name, projects: out }, null, 1);
  }

  if (name === "list_notes") {
    const parts = [`project.org="${clean(org.id)}"`, "deleted=null"];
    if (args.project_id) parts.push(`project="${clean(String(args.project_id))}"`);
    if (args.status) parts.push(`status="${clean(String(args.status))}"`);
    if (args.tag) parts.push(`tags~"${clean(String(args.tag))}"`);
    const limit = Math.min(Number(args.limit ?? 30), 100);
    const notes = await pb.collection("notes").getList(1, limit, { filter: parts.join(" && "), sort: "-created" });
    return JSON.stringify(
      {
        total: notes.totalItems,
        notes: notes.items.map((n) => ({
          id: n.id, project_id: n.project, comment: n.comment, selector: n.selector,
          page: (n.meta as { url?: string })?.url ?? "", status: n.status, tags: n.tags ?? [],
          reporter: n.reporter_name || null, created: n.created,
        })),
        next_step: "Call get_fix_prompt with the note_ids you plan to fix.",
      },
      null, 1
    );
  }

  if (name === "get_fix_prompt") {
    const notes = await orgNotes(org.id, (args.note_ids as string[]) ?? []);
    if (notes.length === 0) return "No matching notes in this org.";
    const items = [];
    for (const n of notes) {
      let snap = null;
      try {
        snap = await pb.collection("note_snapshots").getFirstListItem(`note="${n.id}"`);
      } catch { /* thiếu snapshot vẫn ra prompt */ }
      items.push({
        note: { comment: n.comment, selector: n.selector, dom_text: n.dom_text, meta: n.meta, hasScreenshot: !!snap?.screenshot },
        snap: snap ? { dom_html: snap.dom_html, computed_style: snap.computed_style, screenshot_url: snap.screenshot_url } : null,
      });
    }
    const project = await pb.collection("projects").getOne(notes[0].project);
    const prompt = items.length === 1 ? buildPrompt(items[0].note, items[0].snap) : buildBatchPrompt(project.name, items);
    return `${prompt}\n\n---\nAfter applying the fixes, call resolve_notes with these ids: ${notes.map((n) => n.id).join(", ")}`;
  }

  if (name === "resolve_notes") {
    const notes = await orgNotes(org.id, (args.note_ids as string[]) ?? []);
    if (notes.length === 0) return "No matching notes in this org.";
    const now = new Date().toISOString();
    const rproj = await pb.collection("projects").getOne(notes[0].project);
    for (const n of notes) {
      await pb.collection("notes").update(n.id, { status: "resolved", status_changed_at: now });
      if (rproj.webhook_url)
        fireWebhook(rproj as any, "note.resolved",
          { id: n.id, comment: n.comment, selector: n.selector, status: "resolved", tags: n.tags, meta: n.meta as any, reporter_name: n.reporter_name }, appOrigin());
    }
    let emailed = 0;
    if (args.send_email !== false) {
      const project = await pb.collection("projects").getOne(notes[0].project);
      const byReporter = new Map<string, { name: string; items: { id: string; comment: string }[] }>();
      for (const n of notes) {
        if (!n.reporter_email || n.reporter_emailed_at) continue;
        const g = byReporter.get(n.reporter_email) ?? { name: n.reporter_name as string, items: [] };
        g.items.push({ id: n.id, comment: n.comment });
        byReporter.set(n.reporter_email, g);
      }
      for (const [email, g] of byReporter) {
        const ok = await sendBatchResolvedEmail({ to: email, reporterName: g.name, items: g.items, projectName: project.name });
        if (ok) {
          emailed++;
          for (const x of g.items) await pb.collection("notes").update(x.id, { reporter_emailed_at: new Date().toISOString() }).catch(() => {});
        }
      }
    }
    return `Resolved ${notes.length} note(s). Emailed ${emailed} reporter(s).`;
  }

  if (name === "set_status") {
    const status = String(args.status);
    if (!["new", "in_progress", "spam"].includes(status)) return "Invalid status.";
    const notes = await orgNotes(org.id, (args.note_ids as string[]) ?? []);
    const now = new Date().toISOString();
    for (const n of notes) await pb.collection("notes").update(n.id, { status, status_changed_at: now });
    return `Updated ${notes.length} note(s) to ${status}.`;
  }

  if (name === "create_project") {
    const pname = String(args.name ?? "").trim().slice(0, 80);
    if (!pname) return "name is required.";
    const lang = args.default_lang === "vi" ? "vi" : "en";
    const project = await pb.collection("projects").create({
      org: clean(org.id), name: pname, widget_key: randomBytes(12).toString("hex"),
      domains: [], default_lang: lang, settings: {},
    });
    const origin = appOrigin();
    return JSON.stringify({
      id: project.id, name: project.name, widget_key: project.widget_key,
      snippet: `<script src="${origin}/w.js" data-key="${project.widget_key}" defer></script>`,
      review_link: `${origin}/r/${project.widget_key}`,
    }, null, 1);
  }

  if (name === "submit_note") {
    // verify project thuộc org (scope cứng), rồi tạo note reporter=AI
    let project;
    try {
      project = await pb.collection("projects").getFirstListItem(
        `id="${clean(String(args.project_id ?? ""))}" && org="${clean(org.id)}"`
      );
    } catch {
      return "Project not found in this org — call list_projects first.";
    }
    const comment = String(args.comment ?? "").slice(0, 5000);
    if (!comment) return "comment is required.";
    const tag = typeof args.tag === "string" && args.tag in TAGS ? [String(args.tag)] : classifyNote(comment);
    const note = await pb.collection("notes").create({
      project: project.id,
      status: "new",
      selector: String(args.selector ?? "(page-level)").slice(0, 1000),
      comment,
      dom_text: "",
      meta: { url: String(args.page_url ?? ""), via: "mcp-agent" },
      tags: tag,
      reporter_name: String(args.reporter ?? "AI agent").slice(0, 120),
    });
    notifyTelegram(`◉ KryMark — AI agent filed a note on ${project.name}
"${comment.slice(0, 160)}"
→ ${appOrigin()}/p/${project.id}/n/${note.id}`);
    if (project.webhook_url)
      fireWebhook(project as any, "note.created",
        { id: note.id, comment, selector: String(args.selector ?? ""), status: "new", tags: tag, meta: { url: String(args.page_url ?? "") }, reporter_name: String(args.reporter ?? "AI agent") }, appOrigin());
    return `Note filed: ${note.id} (tag: ${tag[0]}). It appears in the dashboard as reporter "${String(args.reporter ?? "AI agent")}".`;
  }

  if (name === "add_comment") {
    const notes = await orgNotes(org.id, [String(args.note_id ?? "")]);
    if (notes.length === 0) return "Note not found in this org.";
    await pb.collection("comments").create({
      note: notes[0].id, author_type: "system", body: `[via AI/MCP] ${String(args.body ?? "").slice(0, 2000)}`,
    });
    return "Comment added.";
  }

  throw new Error(`Unknown tool: ${name}`);
}
