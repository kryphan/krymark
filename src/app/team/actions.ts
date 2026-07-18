"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";

export async function createInvite(_prev: string | null, formData: FormData) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return "Enter a valid email.";
  try {
    const userId = (pb.authStore.record as { id: string }).id;
    const membership = await pb.collection("members").getFirstListItem(`user="${userId}"`);
    await pb.collection("invites").create({
      org: membership.org,
      email,
      role: "member",
      token: randomBytes(24).toString("hex"),
      expires: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
  } catch {
    return "Couldn't create the invite — try again.";
  }
  revalidatePath("/team");
  return null;
}

// API key cho MCP/AI — gen/regen qua admin sau khi verify membership (orgs updateRule=null)
export async function regenerateApiKey() {
  const { randomBytes } = await import("crypto");
  const { pbAdmin } = await import("@/lib/pb-admin");
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const userId = (pb.authStore.record as { id: string }).id;
  const membership = await pb.collection("members").getFirstListItem(`user="${userId}"`);
  await pbAdmin().collection("orgs").update(membership.org, {
    api_key: `km_live_${randomBytes(16).toString("hex")}`,
  });
  revalidatePath("/team");
}

export async function revokeInvite(inviteId: string) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  await pb.collection("invites").delete(inviteId); // rules: org members only
  revalidatePath("/team");
}
