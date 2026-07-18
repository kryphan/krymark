// Archetype: A Dashboard · dark (Kry UI) — slice 2.2 note detail.
// Translation chamber: HUMAN (left, warm large type) | THE MARK (frozen snapshot) | MACHINE (mono).
// Machine pane gets the AI prompt in slice 3.1.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { Topbar } from "@/components/topbar";
import { StatusButtons } from "./status-buttons";
import { addComment } from "./actions";
import { buildPrompt } from "@/lib/prompt";
import { CopyPrompt } from "./copy-prompt";
import { TagEditor } from "./tag-editor";

type Meta = { url?: string; viewport?: { w: number; h: number }; dpr?: number; lang?: string };

export default async function NoteDetail({ params }: { params: Promise<{ id: string; nid: string }> }) {
  const { id, nid } = await params;
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  let note, snap, comments;
  try {
    note = await pb.collection("notes").getOne(nid);
    comments = await pb.collection("comments").getFullList({ filter: `note="${nid}"`, sort: "created" });
    try {
      snap = await pb.collection("note_snapshots").getFirstListItem(`note="${nid}"`);
    } catch {
      snap = null; // snapshot missing — degrade
    }
  } catch {
    redirect(`/p/${id}`);
  }

  const meta = (note.meta ?? {}) as Meta;
  const addCommentBound = addComment.bind(null, id, nid);
  const prompt = buildPrompt(
    { comment: note.comment, selector: note.selector, dom_text: note.dom_text, meta },
    snap ? { dom_html: snap.dom_html, computed_style: snap.computed_style, screenshot_url: snap.screenshot_url } : null
  );

  return (
    <>
      <Topbar
        crumb={[
          { href: "/projects", label: "Projects" },
          { href: `/p/${id}`, label: "Notes" },
          { href: `/p/${id}/n/${nid}`, label: `◉ ${String(note.selector).slice(0, 28)}` },
        ]}
        actions={
          <Link href={`/p/${id}`} className="btn-ghost btn-sm">
            ← All notes
          </Link>
        }
      />
      <main className="shell" style={{ maxWidth: 1240 }}>
      <div className="chamber">
        {/* HUMAN — what they said */}
        <section className="pane">
          <h3><span className="dot">◉</span> Human · what they said</h3>
          <p className="voice-big">{note.comment}</p>
          <p className="meta-line">
            {note.reporter_name || "Anonymous"}
            {note.reporter_email ? ` · ${note.reporter_email}` : ""}
          </p>
          <p className="meta-line">{new Date(note.created).toLocaleString("en-NZ")}</p>
          <StatusButtons projectId={id} noteId={nid} current={note.status} />
          <TagEditor projectId={id} noteId={nid} initial={(note.tags as string[]) ?? []} />
          {note.status_changed_at && (
            <p className="meta-line" style={{ marginTop: 10 }}>
              Status changed {new Date(note.status_changed_at).toLocaleString("en-NZ")}
            </p>
          )}

          <h3 style={{ marginTop: 22 }}>Team notes</h3>
          {comments.length === 0 && <p className="meta-line">Nothing yet.</p>}
          {comments.map((c) => (
            <div className="comment-item" key={c.id}>
              {c.body}
              <div className="who">
                {c.author_type === "system" ? "system" : "team"} · {new Date(c.created).toLocaleString("en-NZ")}
              </div>
            </div>
          ))}
          <form action={addCommentBound} className="comment-form">
            <input name="body" placeholder="Add an internal note…" maxLength={2000} required />
            <button className="btn-ghost">Post</button>
          </form>
        </section>

        {/* THE MARK — frozen snapshot */}
        <section className="pane">
          <h3>The mark · frozen at report time</h3>
          <p className="meta-line" style={{ marginBottom: 10 }}>
            <span className="chip-mark">◉ {note.selector}</span>
          </p>
          {snap?.screenshot || snap?.screenshot_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="shot" src={`/api/shot/${nid}`} alt="Element screenshot at report time" />
              <a
                href={`/api/shot/${nid}`}
                download={`krymark-${nid}.webp`}
                className="btn-ghost btn-sm"
                style={{ marginTop: 10 }}
              >
                ↓ Download screenshot (for vision AI)
              </a>
            </>
          ) : (
            <div className="shot-missing">
              No screenshot for this spot (cross-origin or capture failed) — the DOM context on the right
              is the load-bearing part.
            </div>
          )}
          <p className="meta-line" style={{ marginTop: 12 }}>{meta.url}</p>
          <p className="meta-line">
            {meta.viewport ? `viewport ${meta.viewport.w}×${meta.viewport.h}` : ""}
            {meta.dpr ? ` · dpr ${meta.dpr}` : ""}
          </p>
          {note.dom_text && <p className="meta-line">text: “{String(note.dom_text).slice(0, 160)}”</p>}
        </section>

        {/* MACHINE — DOM context (prompt export lands in slice 3.1) */}
        <section className="pane machine">
          <h3>Machine · DOM context</h3>
          {snap ? (
            <>
              <div className="mono-block">{snap.dom_html}</div>
              <h3 style={{ marginTop: 16 }}>Computed style</h3>
              <div className="mono-block" style={{ maxHeight: 180 }}>
                {JSON.stringify(snap.computed_style ?? {}, null, 1)}
              </div>
            </>
          ) : (
            <p className="meta-line">Snapshot missing for this note.</p>
          )}
          <CopyPrompt prompt={prompt} />
        </section>
      </div>
      </main>
    </>
  );
}
