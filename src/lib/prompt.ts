// Lát 3.1 — CÁI NÊM: biến note (giọng người + snapshot đóng băng) thành prompt AI
// dán được vào Cursor/Lovable/Claude. Gate T2: sửa đúng ≥3/5 note thật ngay phát đầu.
// Nguyên tắc trim (build-plan 3.1): node chính + style chính, KHÔNG dump — prompt ngắn mà đủ neo.

type Meta = { url?: string; viewport?: { w: number; h: number }; dpr?: number };
type NoteLike = {
  comment: string; selector: string; dom_text?: string;
  meta?: Meta; reporter_name?: string;
};
type SnapLike = { dom_html?: string; computed_style?: Record<string, string>; screenshot_url?: string } | null;

const MAX_HTML = 3500;
const MAX_HTML_BATCH = 1500; // fix session: nhiều item → mỗi item gọn hơn

// Bỏ phần nhiễu (svg ruột, base64, data-attr dài, whitespace) trước khi cắt cứng —
// giữ cấu trúc + class + text làm neo tìm component.
export function trimHtml(html: string, maxLen: number = MAX_HTML): string {
  let out = html
    .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg><!-- trimmed --></svg>")
    .replace(/(src|href)="data:[^"]{80,}"/gi, '$1="data:…trimmed…"')
    .replace(/\s(data-[\w-]{2,}|style)="[^"]{160,}"/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, ">\n<");
  if (out.length > maxLen) {
    out = out.slice(0, maxLen) + "\n<!-- …trimmed: element is larger, structure above is the anchor -->";
  }
  return out.trim();
}

const KEY_STYLES = [
  "display", "position", "width", "height", "margin", "padding", "border",
  "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight", "borderRadius",
] as const;

// Fix Session — 1 prompt gộp N note, đánh số, AI sửa cả loạt trong 1 lần dán
export function buildBatchPrompt(
  projectName: string,
  items: { note: NoteLike & { hasScreenshot?: boolean }; snap: SnapLike }[]
): string {
  const blocks = items.map(({ note, snap }, i) => {
    const meta = note.meta ?? {};
    const cs = snap?.computed_style ?? {};
    const styles: string[] = [];
    for (const k of ["display", "position", "width", "color", "backgroundColor", "fontSize", "fontWeight", "borderRadius"] as const) {
      if (cs[k] && cs[k] !== "none" && cs[k] !== "normal") styles.push(`${k}:${cs[k]}`);
    }
    return `### Item ${i + 1} of ${items.length}
Feedback (verbatim, may be in Vietnamese — translate the INTENT): "${note.comment}"
Page: ${meta.url ?? "?"} · CSS path at report time: \`${note.selector}\`
Element text: ${note.dom_text ? `"${note.dom_text}"` : "(none)"}${snap?.screenshot_url ? `
Screenshot of the element: ${snap.screenshot_url}` : note.hasScreenshot ? " · (screenshot in the KryMark dashboard)" : ""}
Key styles: ${styles.join(" · ") || "(none)"}
\`\`\`html
${snap?.dom_html ? trimHtml(snap.dom_html, MAX_HTML_BATCH) : "(no snapshot — use CSS path + element text)"}
\`\`\``;
  });

  return `You are fixing a live website ("${projectName}") based on ${items.length} pieces of end-user feedback captured by KryMark. Work through ALL items in one pass.

Ground rules:
- For each item, find the component by its TEXT and STRUCTURE first, CSS path second (the codebase may have drifted since capture).
- Make the smallest change that satisfies each item's intent — no redesigns.
- Keep the existing design system consistent. Shared component → fix the shared component once.
- If two items touch the same element, reconcile them into one coherent change.

${blocks.join("\n\n")}

When done, reply with a numbered list matching the items above: file(s) changed + one-line summary each. Flag any item you could NOT locate instead of guessing.`;
}

export function buildPrompt(note: NoteLike, snap: SnapLike): string {
  const meta = note.meta ?? {};
  const styles: string[] = [];
  const cs = snap?.computed_style ?? {};
  for (const k of KEY_STYLES) if (cs[k] && cs[k] !== "none" && cs[k] !== "normal") styles.push(`${k}: ${cs[k]}`);

  return `You are fixing a live website based on end-user feedback captured by KryMark.

## The feedback (verbatim from a non-technical reviewer — may be in Vietnamese; translate the INTENT, not just the words)
"${note.comment}"

## Where they pointed
- Page: ${meta.url ?? "(unknown)"}
- CSS path at report time: \`${note.selector}\`
- Element text: ${note.dom_text ? `"${note.dom_text}"` : "(none)"}
- Viewport: ${meta.viewport ? `${meta.viewport.w}×${meta.viewport.h}` : "?"}${meta.dpr ? ` @${meta.dpr}x` : ""}${snap?.screenshot_url ? `
- Screenshot of the element (fetch/view it if you can): ${snap.screenshot_url}` : ""}

## Element HTML (frozen snapshot — the codebase may have drifted since; match by TEXT and STRUCTURE, not by exact markup or selector)
\`\`\`html
${snap?.dom_html ? trimHtml(snap.dom_html) : "(no snapshot — rely on the CSS path and element text)"}
\`\`\`

## Key computed styles at report time
${styles.length ? styles.map((s) => `- ${s}`).join("\n") : "- (none captured)"}

## Your task
1. Find the component/file in this codebase that renders the element above (search by its text content and class names first, the CSS path second).
2. Make the change the feedback asks for. If the request is ambiguous, choose the smallest change that satisfies its intent — do not redesign around it.
3. Keep the site's existing design system (colors, spacing, typography) consistent.
4. If the element appears in multiple places via a shared component, fix the shared component.
5. End your reply with: the file(s) you changed and a one-line summary of the change.`;
}
