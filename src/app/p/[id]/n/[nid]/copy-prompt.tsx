"use client";

import { useState } from "react";

// Nút NỔI nhất màn detail (build-plan 3.1) — cái nêm nằm ở đây.
export function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        className="btn-primary"
        style={{ marginTop: 16 }}
        onClick={async () => {
          await navigator.clipboard.writeText(prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        }}
      >
        {copied ? "Copied ✓ — paste into Cursor / Lovable" : "Copy AI prompt"}
      </button>
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-dim)" }}>
          Preview prompt ({prompt.length.toLocaleString()} chars)
        </summary>
        <div className="mono-block" style={{ marginTop: 8, maxHeight: 260 }}>{prompt}</div>
      </details>
    </>
  );
}
