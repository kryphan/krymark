"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { sendResolvedEmail } from "@/lib/email";
import { fireWebhook } from "@/lib/webhook";
import { appOrigin } from "@/lib/origin";

// All writes go through the USER client — API rules enforce org scope.

export async function setStatus(projectId: string, noteId: string, status: string) {
  if (!["new", "in_progress", "resolved", "spam"].includes(status)) return;
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const userId = (pb.authStore.record as { id: string }).id;
  const note = await pb.collection("notes").update(noteId, {
    status,
    status_changed_by: userId,                       // C9 audit: "X changed at HH:MM"
    status_changed_at: new Date().toISOString(),
  });
  try {
    const proj = await pb.collection("projects").getOne(projectId);
    if (proj.webhook_url)
      fireWebhook(proj as any, status === "resolved" ? "note.resolved" : "note.status_changed",
        { id: noteId, comment: note.comment, selector: note.selector, status, tags: note.tags, meta: note.meta as any, reporter_name: note.reporter_name }, appOrigin());
  } catch { /* webhook best-effort */ }

  // D5 — vòng đóng: resolve → email reporter 1 LẦN (reporter_emailed_at chống gửi trùng).
  // Best-effort: SES fail thì resolve vẫn xong, không chặn.
  if (status === "resolved" && note.reporter_email && !note.reporter_emailed_at) {
    try {
      const project = await pb.collection("projects").getOne(projectId);
      const meta = (note.meta ?? {}) as { url?: string };
      const sent = await sendResolvedEmail({
        to: note.reporter_email,
        reporterName: note.reporter_name,
        comment: note.comment,
        pageUrl: meta.url,
        projectName: project.name,
        noteId,
      });
      if (sent) {
        await pb.collection("notes").update(noteId, { reporter_emailed_at: new Date().toISOString() });
      }
    } catch {
      /* email là best-effort */
    }
  }

  revalidatePath(`/p/${projectId}/n/${noteId}`);
  revalidatePath(`/p/${projectId}`);
}

export async function softDeleteNote(projectId: string, noteId: string) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  // D10: soft-delete only — deleted notes vanish from view rules, never hard-deleted
  await pb.collection("notes").update(noteId, { deleted: new Date().toISOString() });
  redirect(`/p/${projectId}`);
}

export async function saveTags(projectId: string, noteId: string, tags: string[]) {
  const { TAGS } = await import("@/lib/tags");
  const clean = tags.filter((t) => t in TAGS).slice(0, 4);
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  await pb.collection("notes").update(noteId, { tags: clean });
  revalidatePath(`/p/${projectId}/n/${noteId}`);
  revalidatePath(`/p/${projectId}`);
}

export async function addComment(projectId: string, noteId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const userId = (pb.authStore.record as { id: string }).id;
  await pb.collection("comments").create({
    note: noteId,
    author_type: "member",
    author_user: userId,
    body: body.slice(0, 2000),
  });
  revalidatePath(`/p/${projectId}/n/${noteId}`);
}
