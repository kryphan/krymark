// Archetype: A Dashboard · dark (Kry UI) — v2 shell. Buồng biên dịch: list = giọng người
// + chip mark + pill; Fix Session chọn nhiều. Query nhẹ chỉ bảng notes (C4).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { Topbar } from "@/components/topbar";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton } from "./copy-button";
import { NotesTable, type NoteRow } from "./notes-table";
import { Bookmarklet } from "./bookmarklet";
import { TAGS } from "@/lib/tags";

type Note = {
  id: string; comment: string; selector: string; dom_text: string;
  created: string; status: string; reporter_name: string;
  meta?: { url?: string }; tags?: string[];
};

const STATUSES = ["new", "in_progress", "resolved", "spam"] as const;
const LABEL: Record<string, string> = { new: "New", in_progress: "In progress", resolved: "Resolved", spam: "Spam" };

function pagePath(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return "";
  }
}

export default async function ProjectPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; tag?: string }> }) {
  const { id } = await params;
  const { status, tag } = await searchParams;
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  let project;
  let notes: Note[] = [];
  try {
    project = await pb.collection("projects").getOne(id);
    notes = await pb.collection("notes").getFullList<Note>({
      filter: `project="${id}"`,
      sort: "-created",
      fields: "id,comment,selector,dom_text,created,status,reporter_name,meta,tags",
    });
  } catch {
    redirect("/projects");
  }

  const counts: Record<string, number> = { all: notes.length };
  for (const s of STATUSES) counts[s] = notes.filter((n) => n.status === s).length;
  const tagCounts: Record<string, number> = {};
  for (const n of notes) for (const t of n.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const shown = notes
    .filter((n) => (status ? n.status === status : true))
    .filter((n) => (tag ? (n.tags ?? []).includes(tag) : true));
  const rows: NoteRow[] = shown.map((n) => ({
    id: n.id, comment: n.comment, selector: n.selector, created: n.created,
    status: n.status, reporter_name: n.reporter_name, page: pagePath(n.meta?.url),
    tags: n.tags ?? [],
  }));
  const qp = (st?: string, tg?: string) => {
    const u = new URLSearchParams();
    if (st) u.set("status", st);
    if (tg) u.set("tag", tg);
    const q = u.toString();
    return q ? `?${q}` : "";
  };

  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  const snippet = `<script src="${appOrigin}/w.js" data-key="${project.widget_key}" defer></script>`;
  const email = (pb.authStore.record as { email?: string })?.email;

  return (
    <>
      <Topbar
        crumb={[{ href: "/projects", label: "Projects" }, { href: `/p/${id}`, label: project.name }]}
        userEmail={email}
        actions={
          <Link href={`/p/${id}/settings`} className="btn-ghost btn-sm">
            Settings
          </Link>
        }
      />
      <AutoRefresh />
      <main className="shell">
        <div className="page-head head-row">
          <div>
            <p className="eyebrow">◉ Translation chamber</p>
            <h1 className="headline">
              {project.name} <span className="accent">feedback</span>
            </h1>
          </div>
        </div>

        {notes.length === 0 && (
          <section className="card">
            <p style={{ margin: "0 0 10px", color: "var(--text-dim)", fontSize: 13.5 }}>
              Paste this at the <b style={{ color: "var(--text)" }}>end of &lt;body&gt;</b> (or tell your AI:
              “add this script tag to the end of body”). This page refreshes itself — your first note will
              appear here within seconds.
            </p>
            <pre className="mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{snippet}</pre>
            <CopyButton text={snippet} />
            <p style={{ margin: "16px 0 8px", color: "var(--text-dim)", fontSize: 13 }}>
              Or review <b style={{ color: "var(--text)" }}>without touching the site&apos;s code</b> — drag this
              to your bookmarks bar, then click it on any page:
            </p>
            <Bookmarklet origin={appOrigin} widgetKey={project.widget_key} name={project.name} />
          </section>
        )}

        <div className="kpis">
          <Link href={`/p/${id}${qp(undefined, tag)}`} className={`kpi${!status ? " active" : ""}`}>
            <span className="n">{counts.all}</span> All
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`/p/${id}${qp(s, tag)}`} className={`kpi${status === s ? " active" : ""}`}>
              <span className="n">{counts[s]}</span> {LABEL[s]}
            </Link>
          ))}
        </div>

        {Object.keys(tagCounts).length > 0 && (
          <div className="tagbar">
            {Object.entries(TAGS)
              .filter(([k]) => tagCounts[k])
              .map(([k, v]) => (
                <Link
                  key={k}
                  href={`/p/${id}${qp(status, tag === k ? undefined : k)}`}
                  className={`tag${tag === k ? " on" : ""}`}
                >
                  {v.label}
                  <span className="c">{tagCounts[k]}</span>
                </Link>
              ))}
          </div>
        )}

        {rows.length === 0 ? (
          notes.length > 0 && (
            <div className="empty">No {status ? LABEL[status]?.toLowerCase() : ""} notes here.</div>
          )
        ) : (
          <NotesTable projectId={id} notes={rows} />
        )}
      </main>
    </>
  );
}
