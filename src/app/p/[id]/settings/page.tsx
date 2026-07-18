// Archetype: A Dashboard · dark (Kry UI) — project settings (hoàn thiện, 2026-07-17)
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { Topbar } from "@/components/topbar";
import { CopyButton } from "../copy-button";
import { UpdateForm, DangerZone } from "./settings-forms";
import { Bookmarklet } from "../bookmarklet";

export default async function ProjectSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  let project;
  try {
    project = await pb.collection("projects").getOne(id);
  } catch {
    redirect("/projects");
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  const snippet = `<script src="${appOrigin}/w.js" data-key="${project.widget_key}" defer></script>`;
  const reviewLink = `${appOrigin}/r/${project.widget_key}`;

  return (
    <>
      <Topbar
        crumb={[
          { href: "/projects", label: "Projects" },
          { href: `/p/${id}`, label: project.name },
          { href: `/p/${id}/settings`, label: "Settings" },
        ]}
        actions={
          <Link href={`/p/${id}`} className="btn-ghost btn-sm">
            ← Notes
          </Link>
        }
      />
      <main className="shell" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <p className="eyebrow">◉ Project</p>
        <h1 className="headline">{project.name} <span className="accent">settings</span></h1>
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <UpdateForm projectId={id} name={project.name} domains={project.domains ?? []} lang={project.default_lang ?? "en"} webhookUrl={project.webhook_url ?? ""} webhookSecret={project.webhook_secret ?? ""} />
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Embed snippet</h2>
        <pre className="mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{snippet}</pre>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <CopyButton text={snippet} />
          <Bookmarklet origin={appOrigin} widgetKey={project.widget_key} name={project.name} />
        </div>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Extension link</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 10px" }}>
          Review sites you can&apos;t add code to. Paste this into the KryMark browser extension (or open it for a bookmarklet).
        </p>
        <pre className="mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{reviewLink}</pre>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <CopyButton text={reviewLink} label="Copy extension link" />
          <a href={reviewLink} target="_blank" className="btn-ghost" style={{ textDecoration: "none" }}>Open ↗</a>
        </div>
      </section>

      <section style={{ border: "1px solid rgba(255,61,46,0.3)", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px", color: "var(--mark-soft)" }}>Danger zone</h2>
        <DangerZone projectId={id} projectName={project.name} />
      </section>
      </main>
    </>
  );
}
