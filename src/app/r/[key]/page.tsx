// Public review-link landing — carrier of origin+widget_key cho extension; nếu người mở
// trực tiếp thì hướng dẫn dùng extension / bookmarklet. KHÔNG cần đăng nhập.
import { pbAdmin } from "@/lib/pb-admin";
import { appOrigin } from "@/lib/origin";
import { CopyButton } from "@/app/p/[id]/copy-button";
import { Bookmarklet } from "@/app/p/[id]/bookmarklet";

export default async function ReviewLink({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const origin = appOrigin();
  let name = "this project";
  let valid = false;
  try {
    const p = await pbAdmin().collection("projects").getFirstListItem(`widget_key="${key.replace(/[^a-z0-9]/gi, "")}"`);
    name = p.name;
    valid = true;
  } catch {
    /* unknown key */
  }
  const link = `${origin}/r/${key}`;

  return (
    <main className="auth-card" style={{ maxWidth: 460 }}>
      <p className="eyebrow">◉ Review link</p>
      {!valid ? (
        <>
          <h1 style={{ fontSize: 20, marginTop: 4 }}>This link is invalid</h1>
          <p className="sub">The project may have been deleted or the key regenerated.</p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 20, marginTop: 4 }}>Review “{name}”</h1>
          <p className="sub" style={{ marginBottom: 16 }}>
            Two ways to leave feedback on any site — no code, no login for reviewers.
          </p>

          <h2 style={{ fontSize: 14, margin: "0 0 6px" }}>1 · KryMark browser extension</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 8px" }}>
            Paste this link into the extension popup, open any page, hit Start.
          </p>
          <pre className="mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{link}</pre>
          <CopyButton text={link} label="Copy link" />

          <h2 style={{ fontSize: 14, margin: "20px 0 6px" }}>2 · Bookmarklet</h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 8px" }}>
            Drag to your bookmarks bar, then click it on any page:
          </p>
          <Bookmarklet origin={origin} widgetKey={key} name={name} />
        </>
      )}
    </main>
  );
}
