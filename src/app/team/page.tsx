// Archetype: A Dashboard · dark (Kry UI) — slice 2.3 team.
// Member emails are read via the ADMIN client AFTER verifying the requester's membership
// (users auth collection hides emails cross-user by design).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { Topbar } from "@/components/topbar";
import { pbAdmin } from "@/lib/pb-admin";
import { CopyButton } from "../p/[id]/copy-button";
import { InviteForm, RevokeButton, RegenKeyButton } from "./invite-form";
import { resolveOrgs } from "@/lib/org";

const SEAT_LIMIT = 5; // loose limit (build-plan 2.3) — warn, don't hard-block yet

export default async function TeamPage() {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  const { activeId, orgs } = await resolveOrgs(pb);
  const orgId = activeId;
  if (!orgId) redirect("/projects");

  const admin = pbAdmin();
  const orgRec = await pb.collection("orgs").getOne(orgId);
  const members = await admin.collection("members").getFullList({
    filter: `org="${orgId}"`,
    expand: "user",
  });
  const invites = await pb.collection("invites").getFullList({ filter: `org="${orgId}"`, sort: "-created" });

  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  const seats = members.length + invites.length;

  return (
    <>
      <Topbar
        crumb={[{ href: "/team", label: "Team" }]}
        orgs={orgs}
        activeOrg={activeId}
        actions={
          <Link href="/projects" className="btn-ghost btn-sm">
            ← Projects
          </Link>
        }
      />
      <main className="shell" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <p className="eyebrow">◉ Workspace</p>
        <h1 className="headline">Team</h1>
      </div>

      <section className="card">
        <h2 style={{ fontSize: 14, margin: "0 0 6px" }}>AI access · MCP</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 12.5, margin: "0 0 10px" }}>
          Point Claude Code / Cursor at KryMark — the AI pulls feedback, builds the fix prompt itself and
          resolves notes when done. Full setup in <a href="/docs#mcp">Docs</a>.
        </p>
        {orgRec.api_key ? (
          <>
            <pre className="mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{`{
  "mcpServers": {
    "krymark": {
      "type": "http",
      "url": "${appOrigin}/api/mcp",
      "headers": { "Authorization": "Bearer ${orgRec.api_key}" }
    }
  }
}`}</pre>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <CopyButton text={orgRec.api_key} label="Copy API key" />
              <RegenKeyButton hasKey={true} />
            </div>
          </>
        ) : (
          <RegenKeyButton hasKey={false} />
        )}
      </section>

      <h2 style={{ fontSize: 16 }}>Members · {members.length}</h2>
      <ul className="project-list">
        {members.map((m) => (
          <li key={m.id}>
            <span>{(m.expand?.user as { email?: string })?.email ?? m.user}</span>
            <span className="key">{m.role}</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 26 }}>Invite someone</h2>
      {seats >= SEAT_LIMIT && (
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
          Heads up: {seats}/{SEAT_LIMIT} seats used — the free plan is meant for teams up to {SEAT_LIMIT}.
        </p>
      )}
      <InviteForm />

      {invites.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 10 }}>Pending invites</h2>
          <ul className="project-list">
            {invites.map((i) => {
              const link = `${appOrigin}/invite/${i.token}`;
              return (
                <li key={i.id} style={{ flexWrap: "wrap", gap: 8 }}>
                  <span>
                    {i.email}
                    <span className="key" style={{ marginLeft: 10 }}>
                      expires {new Date(i.expires).toLocaleDateString("en-NZ")}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <CopyButton text={link} label="Copy invite link" />
                    <RevokeButton inviteId={i.id} />
                  </span>
                </li>
              );
            })}
          </ul>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Send the link yourself (chat/email) — automatic invite emails come later.
          </p>
        </>
      )}
      </main>
    </>
  );
}
