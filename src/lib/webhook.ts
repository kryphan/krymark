import { createHmac } from "crypto";

// Outbound webhook — generic, OSS-friendly. Note event → POST tới project.webhook_url.
// Fire-and-forget, HMAC-signed (header X-KryMark-Signature = sha256=<hex>) để bên nhận verify.
// Cắm n8n / Slack (qua middleware) / ClickUp / Zapier / bất kỳ endpoint nào — không hardcode dịch vụ.

type WebhookEvent = "note.created" | "note.resolved" | "note.status_changed";

type ProjectLike = { id: string; name: string; webhook_url?: string; webhook_secret?: string };
type NoteLike = {
  id: string; comment: string; selector: string; status: string;
  tags?: string[]; reporter_name?: string; reporter_email?: string;
  meta?: { url?: string };
};

export function fireWebhook(
  project: ProjectLike,
  event: WebhookEvent,
  note: NoteLike,
  origin: string
): void {
  const url = project.webhook_url;
  if (!url || !/^https?:\/\//.test(url)) return;

  const payload = {
    event,
    sent_at: new Date().toISOString(),
    project: { id: project.id, name: project.name },
    note: {
      id: note.id,
      comment: note.comment,
      selector: note.selector,
      status: note.status,
      tags: note.tags ?? [],
      page_url: note.meta?.url ?? "",
      reporter_name: note.reporter_name || null,
      dashboard_url: `${origin}/p/${project.id}/n/${note.id}`,
    },
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "KryMark-Webhook/1",
    "X-KryMark-Event": event,
  };
  if (project.webhook_secret) {
    const sig = createHmac("sha256", project.webhook_secret).update(body).digest("hex");
    headers["X-KryMark-Signature"] = `sha256=${sig}`;
  }
  fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) }).catch(() => {});
}
