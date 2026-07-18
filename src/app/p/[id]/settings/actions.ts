"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";

// User client — rules org-scope lo quyền.

export async function updateProject(projectId: string, _prev: string | null, formData: FormData) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Project needs a name.";
  const domains = String(formData.get("domains") ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  const default_lang = String(formData.get("default_lang") ?? "en") === "vi" ? "vi" : "en";
  const webhook_url = String(formData.get("webhook_url") ?? "").trim();
  const webhook_secret = String(formData.get("webhook_secret") ?? "").trim();
  if (webhook_url && !/^https?:\/\//.test(webhook_url)) return "Webhook URL must start with http(s)://";
  try {
    await pb.collection("projects").update(projectId, { name, domains, default_lang, webhook_url, webhook_secret });
  } catch {
    return "Couldn't save — try again.";
  }
  revalidatePath(`/p/${projectId}/settings`);
  revalidatePath(`/p/${projectId}`);
  return null;
}

export async function regenerateKey(projectId: string) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  // Snippet cũ chết ngay lập tức — UI đã bắt confirm trước khi gọi
  await pb.collection("projects").update(projectId, { widget_key: randomBytes(12).toString("hex") });
  revalidatePath(`/p/${projectId}/settings`);
  revalidatePath(`/p/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  // Hard delete cascade notes/snapshots/comments — UI bắt gõ đúng tên project để confirm
  await pb.collection("projects").delete(projectId);
  redirect("/projects");
}

export async function testWebhook(projectId: string): Promise<string> {
  const { fireWebhook } = await import("@/lib/webhook");
  const { appOrigin } = await import("@/lib/origin");
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  let project;
  try {
    project = await pb.collection("projects").getOne(projectId);
  } catch {
    return "Project not found.";
  }
  if (!project.webhook_url) return "Save a webhook URL first.";
  fireWebhook(project as never, "note.created", {
    id: "test_note", comment: "This is a KryMark webhook test.", selector: "body",
    status: "new", tags: ["other"], meta: { url: appOrigin() },
    reporter_name: "KryMark",
  }, appOrigin());
  return `Test event sent to ${project.webhook_url}`;
}
