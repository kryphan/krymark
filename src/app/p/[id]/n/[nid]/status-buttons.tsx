"use client";

import { useTransition } from "react";
import { setStatus, softDeleteNote } from "./actions";
import { bulkDelete } from "../../batch-actions";

const STATUSES = [
  ["new", "New"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
  ["spam", "Spam"],
] as const;

export function StatusButtons({ projectId, noteId, current }: { projectId: string; noteId: string; current: string }) {
  const [pending, start] = useTransition();
  return (
    <>
      <div className="status-row">
        {STATUSES.map(([value, label]) => (
          <button
            key={value}
            className={current === value ? "on" : ""}
            disabled={pending || current === value}
            onClick={() => start(() => setStatus(projectId, noteId, value))}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
        <button
          className="danger-link"
          disabled={pending}
          onClick={() => {
            if (confirm("Hide this note? (soft-delete — recoverable by support)")) {
              start(() => softDeleteNote(projectId, noteId));
            }
          }}
        >
          Hide note
        </button>
        <button
          className="danger-link"
          disabled={pending}
          onClick={() => {
            if (confirm("DELETE this note FOREVER?\n\nScreenshot + comments go with it. Cannot be undone.")) {
              start(async () => {
                await bulkDelete(projectId, [noteId]);
                window.location.href = `/p/${projectId}`;
              });
            }
          }}
        >
          Delete forever
        </button>
      </div>
    </>
  );
}
