// Archetype: A Dashboard · dark (Kry UI, chuẩn tỷ lệ Apple HIG §10) — v3:
// 3 view (List / Cards / Board kéo-thả) + tag + Fix Session bulk bar.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { getBatchPrompt, resolveBatch, bulkStatus, bulkHide, bulkDelete } from "./batch-actions";
import { setStatus } from "./n/[nid]/actions";
import { TAGS } from "@/lib/tags";

export type NoteRow = {
  id: string; comment: string; selector: string; created: string;
  status: string; reporter_name: string; page: string; tags: string[];
};

const LABEL: Record<string, string> = { new: "NEW", in_progress: "IN PROGRESS", resolved: "RESOLVED", spam: "SPAM" };
const BOARD_COLS: { key: string; title: string }[] = [
  { key: "new", title: "New" },
  { key: "in_progress", title: "In progress" },
  { key: "resolved", title: "Resolved" },
  { key: "spam", title: "Spam" },
];
type ViewMode = "list" | "cards" | "board";

function Shot({ noteId, className }: { noteId: string; className?: string }) {
  const [dead, setDead] = useState(false);
  if (dead) return className ? <div className="noshot">no shot</div> : <div className="thumb-empty">no shot</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className ?? "thumb"} src={`/api/shot/${noteId}`} alt="" loading="lazy" onError={() => setDead(true)} />
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotesTable({ projectId, notes }: { projectId: string; notes: NoteRow[] }) {
  const [view, setView] = useState<ViewMode>("list");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const dragId = useRef<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("km-view") as ViewMode | null;
    if (saved === "cards" || saved === "board") setView(saved);
  }, []);
  const switchView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("km-view", v);
    setSel(new Set());
  };

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = notes.length > 0 && sel.size === notes.length;
  const ids = [...sel];

  const copyBatch = () =>
    start(async () => {
      const prompt = await getBatchPrompt(projectId, ids);
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });

  const dropTo = (status: string) => {
    const id = dragId.current;
    dragId.current = null;
    setOverCol(null);
    if (!id) return;
    const cur = notes.find((n) => n.id === id);
    if (!cur || cur.status === status) return;
    start(() => setStatus(projectId, id, status));
  };

  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());
  const toggleCluster = (k: string) =>
    setOpenClusters((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const renderRow = (n: NoteRow, isDup: boolean, clusterSize: number, clusterKey: string) => (
    <div key={n.id} className={`nrow${sel.has(n.id) ? " sel" : ""}${isDup ? " dup" : ""}`}>
      <input type="checkbox" className="ck" checked={sel.has(n.id)} onChange={() => toggle(n.id)} aria-label="Select note" />
      <Link href={`/p/${projectId}/n/${n.id}`} tabIndex={-1}>
        <Shot noteId={n.id} />
      </Link>
      <Link href={`/p/${projectId}/n/${n.id}`} className="body">
        <p className="voice">{n.comment}</p>
        <div className="meta">
          <span className="chip-mark">◉ {n.selector}</span>
          <TagMinis tags={n.tags} />
          <span>
            {n.reporter_name ? `${n.reporter_name} · ` : ""}
            {fmtTime(n.created)}
          </span>
        </div>
      </Link>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {clusterSize > 0 && (
          <button
            className="cluster-badge"
            onClick={(e) => {
              e.preventDefault();
              toggleCluster(clusterKey);
            }}
            title={`${clusterSize} reports on this element`}
          >
            ×{clusterSize}
          </button>
        )}
        <span className={`pill ${n.status}`}>{LABEL[n.status] ?? n.status}</span>
      </span>
    </div>
  );

  const TagMinis = ({ tags }: { tags: string[] }) => (
    <>
      {(tags ?? []).map((t) => (
        <span key={t} className="tag-mini">{TAGS[t]?.label ?? t}</span>
      ))}
    </>
  );

  return (
    <>
      <div className="toolbar">
        <div className="left">
          {view !== "board" && (
            <input
              type="checkbox"
              className="ck"
              checked={allSelected}
              aria-label="Select all"
              onChange={() => setSel(allSelected ? new Set() : new Set(notes.map((n) => n.id)))}
            />
          )}
          <span>
            {sel.size > 0 ? `${sel.size} selected` : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="viewsw" role="tablist" aria-label="View mode">
          {(["list", "cards", "board"] as ViewMode[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => switchView(v)}>
              {v === "list" ? "List" : v === "cards" ? "Cards" : "Board"}
            </button>
          ))}
        </div>
      </div>

      {view === "list" && (
        <div className="ntable">
          {(() => {
            // #5 gom theo trang + #6 cụm trùng selector (tính lúc render, không lưu cột)
            const byPage = new Map<string, NoteRow[]>();
            for (const n of notes) {
              const k = n.page || "";
              byPage.set(k, [...(byPage.get(k) ?? []), n]);
            }
            const multiPage = byPage.size > 1;
            const out: React.ReactNode[] = [];
            for (const [pg, rows] of byPage) {
              if (multiPage)
                out.push(
                  <div key={`h-${pg}`} className="pg-head">
                    <span className="mono">{pg || "(unknown page)"}</span>
                    <span className="kbd">{rows.length}</span>
                  </div>
                );
              const bySel = new Map<string, NoteRow[]>();
              for (const n of rows) bySel.set(n.selector, [...(bySel.get(n.selector) ?? []), n]);
              for (const [sel, cluster] of bySel) {
                const ck = `${pg}|${sel}`;
                const visible = openClusters.has(ck) ? cluster : [cluster[0]];
                visible.forEach((n, idx) =>
                  out.push(renderRow(n, idx > 0, cluster.length > 1 && idx === 0 ? cluster.length : 0, ck))
                );
              }
            }
            return out;
          })()}
        </div>
      )}

      {false && (
        <div>
          {notes.map((n) => (
            <div key={n.id} className={`nrow${sel.has(n.id) ? " sel" : ""}`}>
              <input type="checkbox" className="ck" checked={sel.has(n.id)} onChange={() => toggle(n.id)} aria-label="Select note" />
              <Link href={`/p/${projectId}/n/${n.id}`} tabIndex={-1}>
                <Shot noteId={n.id} />
              </Link>
              <Link href={`/p/${projectId}/n/${n.id}`} className="body">
                <p className="voice">{n.comment}</p>
                <div className="meta">
                  <span className="chip-mark">◉ {n.selector}</span>
                  <TagMinis tags={n.tags} />
                  {n.page && <span className="pg-path">{n.page}</span>}
                  <span>
                    {n.reporter_name ? `${n.reporter_name} · ` : ""}
                    {fmtTime(n.created)}
                  </span>
                </div>
              </Link>
              <span className={`pill ${n.status}`}>{LABEL[n.status] ?? n.status}</span>
            </div>
          ))}
        </div>
      )}

      {view === "cards" && (
        <div className="cardgrid">
          {notes.map((n) => (
            <div key={n.id} className={`ncard${sel.has(n.id) ? " sel" : ""}`}>
              <input type="checkbox" className="ck" checked={sel.has(n.id)} onChange={() => toggle(n.id)} aria-label="Select note" />
              <Link href={`/p/${projectId}/n/${n.id}`} className="shotbox">
                <Shot noteId={n.id} className="cardimg" />
              </Link>
              <Link href={`/p/${projectId}/n/${n.id}`} className="cbody">
                <p className="voice">{n.comment}</p>
                <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <TagMinis tags={n.tags} />
                </div>
                <div className="cfoot">
                  <span className={`pill ${n.status}`}>{LABEL[n.status] ?? n.status}</span>
                  <span className="when">{fmtTime(n.created)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {view === "board" && (
        <div className="board">
          {BOARD_COLS.map((col) => {
            const items = notes.filter((n) => n.status === col.key);
            return (
              <div
                key={col.key}
                className={`kb-col${overCol === col.key ? " over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  dropTo(col.key);
                }}
              >
                <div className="kb-head">
                  <span className="t">{col.title}</span>
                  <span className="kbd">{items.length}</span>
                </div>
                {items.map((n) => (
                  <Link
                    key={n.id}
                    href={`/p/${projectId}/n/${n.id}`}
                    className="kb-card"
                    draggable
                    onDragStart={() => (dragId.current = n.id)}
                  >
                    <p className="voice">{n.comment}</p>
                    <div className="meta">
                      ◉ {n.selector.slice(0, 34)}
                      {n.tags?.[0] ? ` · ${TAGS[n.tags[0]]?.label ?? n.tags[0]}` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {sel.size > 0 && view !== "board" && (
        <div className="bulkbar">
          <span className="count">◉ {sel.size}</span>
          <button className="btn-mark" disabled={pending} onClick={copyBatch}>
            {copied ? "Copied ✓ paste into Cursor" : pending ? "Building…" : "Copy batch prompt"}
          </button>
          <button
            className="btn-ghost btn-sm"
            disabled={pending}
            onClick={() => start(async () => { await resolveBatch(projectId, ids); setSel(new Set()); })}
          >
            Resolve all <span style={{ color: "var(--text-3)", fontSize: 11 }}>(+email reporters)</span>
          </button>
          <button className="btn-ghost btn-sm" disabled={pending}
            onClick={() => start(async () => { await bulkStatus(projectId, ids, "spam"); setSel(new Set()); })}>
            Spam
          </button>
          <button className="btn-ghost btn-sm" disabled={pending}
            onClick={() => {
              if (confirm(`Hide ${sel.size} note(s)? They disappear from the dashboard (soft-delete).`))
                start(async () => { await bulkHide(projectId, ids); setSel(new Set()); });
            }}>
            Hide
          </button>
          <button className="danger-link" disabled={pending}
            onClick={() => {
              if (confirm(`DELETE ${sel.size} note(s) FOREVER?

This also deletes screenshots and comments. Cannot be undone. (Use Hide if unsure.)`))
                start(async () => { await bulkDelete(projectId, ids); setSel(new Set()); });
            }}>
            Delete
          </button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => setSel(new Set())}>
            ✕
          </button>
        </div>
      )}
    </>
  );
}
