// Archetype: A Dashboard · dark (Kry UI) — invite accept (slice 2.3).
import Link from "next/link";
import { createClient } from "@/lib/pb";
import { pbAdmin } from "@/lib/pb-admin";
import { AcceptButton } from "./accept-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pb = await createClient();

  // Invite lookup needs admin (anon can't read invites — by design)
  const admin = pbAdmin();
  let invite: { org: string; email: string; expires: string } | null = null;
  let orgName = "";
  try {
    const inv = await admin
      .collection("invites")
      .getFirstListItem(`token="${token.replace(/"/g, "")}"`);
    if (new Date(inv.expires) > new Date()) {
      invite = { org: inv.org, email: inv.email, expires: inv.expires };
      orgName = (await admin.collection("orgs").getOne(inv.org)).name;
    }
  } catch {
    /* not found */
  }

  return (
    <main className="auth-card">
      <h1>Team invite</h1>
      {!invite ? (
        <>
          <p className="sub">This invite link is invalid or has expired.</p>
          <Link href="/login" className="btn-ghost" style={{ textDecoration: "none" }}>
            Go to login
          </Link>
        </>
      ) : !pb.authStore.isValid ? (
        <>
          <p className="sub">
            You’ve been invited to join <b style={{ color: "var(--text)" }}>{orgName}</b> ({invite.email}).
            Log in or sign up first, then open this link again.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/signup" className="btn-ghost" style={{ textDecoration: "none" }}>
              Sign up
            </Link>
            <Link href="/login" className="btn-ghost" style={{ textDecoration: "none" }}>
              Log in
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="sub">
            Join <b style={{ color: "var(--text)" }}>{orgName}</b> as{" "}
            {(pb.authStore.record as { email?: string })?.email}?
          </p>
          <AcceptButton token={token} />
        </>
      )}
    </main>
  );
}
