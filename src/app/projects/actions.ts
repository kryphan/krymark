"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";

// Create a project inside the user's org (rules allow create when member — slice 1.3).
export async function createProject(_prev: string | null, formData: FormData) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Give the project a name first.";
  const domains = String(formData.get("domains") ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);

  let projectId = "";
  try {
    const { resolveOrgs } = await import("@/lib/org");
    const { activeId } = await resolveOrgs(pb);
    const project = await pb.collection("projects").create({
      org: activeId,
      name,
      widget_key: randomBytes(12).toString("hex"),
      domains,
      default_lang: "en",
      settings: {},
    });
    projectId = project.id;
  } catch {
    return "Couldn't create the project — please try again.";
  }
  redirect(`/p/${projectId}`);
}
