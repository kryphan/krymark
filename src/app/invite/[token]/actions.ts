"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { pbAdmin } from "@/lib/pb-admin";

// Accept runs through ADMIN (members.createRule = null by design) after verifying:
// token exists + not expired + current user authenticated. Invite is deleted on success.
export async function acceptInvite(token: string, _prev: string | null) {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");
  const userId = (pb.authStore.record as { id: string }).id;

  const admin = pbAdmin();
  let invite;
  try {
    invite = await admin.collection("invites").getFirstListItem(`token="${token.replace(/"/g, "")}"`);
  } catch {
    return "This invite link is invalid.";
  }
  if (new Date(invite.expires) <= new Date()) return "This invite has expired.";

  try {
    await admin.collection("members").create({
      org: invite.org,
      user: userId,
      role: invite.role || "member",
    });
  } catch {
    return "You're already a member of this team (or joining failed).";
  }
  await admin.collection("invites").delete(invite.id).catch(() => {});
  redirect("/projects");
}
