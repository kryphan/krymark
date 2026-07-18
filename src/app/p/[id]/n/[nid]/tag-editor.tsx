"use client";

import { useState, useTransition } from "react";
import { saveTags } from "./actions";
import { TAGS } from "@/lib/tags";

// Tag do AI gán lúc note vào (heuristic) — dashboard sửa 1 chạm, lưu ngay
export function TagEditor({ projectId, noteId, initial }: { projectId: string; noteId: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial ?? []);
  const [pending, start] = useTransition();

  const toggle = (t: string) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setTags(next);
    start(() => saveTags(projectId, noteId, next));
  };

  return (
    <div className="tagbar" style={{ margin: "12px 0 0" }}>
      {Object.entries(TAGS).map(([k, v]) => (
        <button
          key={k}
          type="button"
          className={`tag${tags.includes(k) ? " on" : ""}`}
          style={{ cursor: "pointer", opacity: pending ? 0.7 : 1 }}
          onClick={() => toggle(k)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
