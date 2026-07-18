"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { buildBatchPrompt } from "@/lib/prompt";
import { sendBatchResolvedEmail } from "@/lib/email";
import { fireWebhook } from "@/lib/webhook";
import { appOrigin } from "@/lib/origin";

// Fix Session — mọi thứ đi qua USER client (rules org-scope), cap 20 note/đợt.
const CAP = 20;

async function authed() {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  return pb;
}

function idFilter(ids: string[], projectId: string): string {
  const safe = ids.slice(0, CAP).map((i) => i.replace(/[^a-z0-9]/gi, ""));
  return `project="${projectId.replace(/[^a-z0-9]/gi, "")}" && (${safe.map((i) => `id="${i}"`).join(" || ")})`;
}

export async function getBatchPrompt(projectId: string, noteIds: string[]): Promise<string> {
  const pb = await authed();
  const project = await pb.collection("projects").getOne(projectId);
  const notes = await pb.collection("notes").getFullList({ filter: idFilter(noteIds, projectId), sort: "created" });
  const items = [];
  for (const n of notes) {
    let snap = null;
    let hasScreenshot = false;
    try {
      snap = await pb.collection("note_snapshots").getFirstListItem(`note="${n.id}"`);
      hasScreenshot = !!(snap.screenshot || snap.screenshot_url);
    } catch {
      /* snapshot thiếu — item vẫn vào prompt với CSS path */
    }
    items.push({
      note: {
        comment: n.comment, selector: n.selector, dom_text: n.dom_text,
        meta: n.meta, hasScreenshot,
      },
      snap: snap ? { dom_html: snap.dom_html, computed_style: snap.computed_style, screenshot_url: snap.screenshot_url } : null,
    });
  }
  return buildBatchPrompt(project.name, items);
}

export async function resolveBatch(projectId: string, noteIds: string[]) {
  const pb = await authed();
  const userId = (pb.authStore.record as { id: string }).id;
  const project = await pb.collection("projects").getOne(projectId);
  const notes = await pb.collection("notes").getFullList({ filter: idFilter(noteIds, projectId) });

  const now = new Date().toISOString();
  const origin = appOrigin();
  for (const n of notes) {
    await pb.collection("notes").update(n.id, {
      status: "resolved", status_changed_by: userId, status_changed_at: now,
    });
    if (project.webhook_url)
      fireWebhook(project as any, "note.resolved",
        { id: n.id, comment: n.comment, selector: n.selector, status: "resolved", tags: n.tags, meta: n.meta as any, reporter_name: n.reporter_name }, origin);
  }

  // Email GỘP: group theo reporter_email, chỉ note chưa từng email (D5)
  const byReporter = new Map<string, { name: string; notes: { id: string; comment: string }[] }>();
  for (const n of notes) {
    if (!n.reporter_email || n.reporter_emailed_at) continue;
    const g = byReporter.get(n.reporter_email) ?? {
      name: n.reporter_name as string,
      notes: [] as { id: string; comment: string }[],
    };
    g.notes.push({ id: n.id, comment: n.comment });
    byReporter.set(n.reporter_email, g);
  }
  for (const [email, g] of byReporter) {
    const sent = await sendBatchResolvedEmail({
      to: email, reporterName: g.name, items: g.notes, projectName: project.name,
    });
    if (sent) {
      for (const x of g.notes) {
        await pb.collection("notes").update(x.id, { reporter_emailed_at: new Date().toISOString() }).catch(() => {});
      }
    }
  }
  revalidatePath(`/p/${projectId}`);
}

export async function bulkStatus(projectId: string, noteIds: string[], status: "spam" | "in_progress" | "new") {
  const pb = await authed();
  const userId = (pb.authStore.record as { id: string }).id;
  const notes = await pb.collection("notes").getFullList({ filter: idFilter(noteIds, projectId), fields: "id" });
  const now = new Date().toISOString();
  for (const n of notes) {
    await pb.collection("notes").update(n.id, { status, status_changed_by: userId, status_changed_at: now });
  }
  revalidatePath(`/p/${projectId}`);
}

// D10' — XOÁ HẲN: note + snapshot/comment (cascade) + object S3. Không hoàn tác được.
export async function bulkDelete(projectId: string, noteIds: string[]) {
  const pb = await authed();
  const { deleteShot } = await import("@/lib/s3");
  const notes = await pb.collection("notes").getFullList({ filter: idFilter(noteIds, projectId), fields: "id" });
  for (const n of notes) {
    try {
      const snap = await pb.collection("note_snapshots").getFirstListItem(`note="${n.id}"`);
      if (snap.screenshot_url) await deleteShot(snap.screenshot_url);
    } catch {
      /* không có snapshot/ảnh — kệ */
    }
    await pb.collection("notes").delete(n.id); // rules org-scope; cascade snapshot+comment
  }
  revalidatePath(`/p/${projectId}`);
}

export async function bulkHide(projectId: string, noteIds: string[]) {
  const pb = await authed();
  const notes = await pb.collection("notes").getFullList({ filter: idFilter(noteIds, projectId), fields: "id" });
  const now = new Date().toISOString();
  for (const n of notes) {
    await pb.collection("notes").update(n.id, { deleted: now }); // D10 soft-delete
  }
  revalidatePath(`/p/${projectId}`);
}
