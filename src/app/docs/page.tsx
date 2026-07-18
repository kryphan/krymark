// Archetype: C Landing · warm (Kry UI) — GĐ4 docs dán snippet RIÊNG từng nền (challenger-ux C11).
import Link from "next/link";

import { appOrigin } from "@/lib/origin";

const ORIGIN = appOrigin();
const SNIPPET = `<script src="${ORIGIN}/w.js" data-key="YOUR_WIDGET_KEY" defer></script>`;

export default function DocsPage() {
  return (
    <div className="landing">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <nav>
          <Link href="/" className="wordmark" style={{ textDecoration: "none" }}>
            kry<b>mark</b>
          </Link>
          <span className="nav-links">
            <Link href="/login" className="btn-line">Log in</Link>
            <Link href="/signup" className="btn-fill">Get started</Link>
          </span>
        </nav>

        <h1 style={{ fontSize: 30, margin: "26px 0 6px" }}>Install the widget</h1>
        <p style={{ color: "var(--l-dim)", maxWidth: 620 }}>
          One snippet, pasted at the end of <code style={{ background: "#f4ece0", padding: "1px 6px", borderRadius: 4 }}>&lt;body&gt;</code>.
          Get your <b>widget key</b> from your project page after{" "}
          <Link href="/signup">creating a workspace</Link>.
        </p>
        <div className="doc-code">{SNIPPET}</div>

        <div className="doc-section">
          <h2>Lovable</h2>
          <p>
            In the chat, tell Lovable: <i>“Add this script tag at the end of the body in index.html,
            keep it exactly as-is”</i> and paste the snippet. Publish — the Feedback tab appears on
            your live preview and published site.
          </p>
        </div>

        <div className="doc-section">
          <h2>Bolt / v0</h2>
          <p>
            Same move: ask the AI to add the snippet to the root HTML (Bolt: <code>index.html</code>;
            v0/Next: the root layout, see below). If the AI wraps it in a component, tell it to keep
            the plain <code>&lt;script&gt;</code> tag with the <code>defer</code> attribute.
          </p>
        </div>

        <div className="doc-section">
          <h2>Cursor · Next.js</h2>
          <p>In <code>app/layout.tsx</code>, add before the closing body tag:</p>
          <div className="doc-code">{`<Script src="${ORIGIN}/w.js" data-key="YOUR_WIDGET_KEY" strategy="afterInteractive" />`}</div>
          <p style={{ marginTop: 8 }}>
            (import <code>Script</code> from <code>next/script</code>). Plain React/Vite: put the
            script tag in <code>index.html</code>.
          </p>
        </div>

        <div className="doc-section">
          <h2>Webflow · WordPress · anything else</h2>
          <p>
            Webflow: Site settings → Custom code → Footer code. WordPress: any “header &amp; footer
            scripts” plugin, footer slot. Static HTML: paste right before <code>&lt;/body&gt;</code>.
          </p>
        </div>

        <div className="doc-section" id="mcp">
          <h2>AI access — MCP (Claude Code / Cursor)</h2>
          <p>
            Let your AI editor pull feedback and fix it without copy-paste. Get the API key from{" "}
            <b>Team → AI access</b>, then add to <code>.mcp.json</code> (Claude Code) or MCP settings (Cursor):
          </p>
          <div className="doc-code">{`{
  "mcpServers": {
    "krymark": {
      "type": "http",
      "url": "${ORIGIN}/api/mcp",
      "headers": { "Authorization": "Bearer km_live_YOUR_KEY" }
    }
  }
}`}</div>
          <p style={{ marginTop: 8 }}>
            Tools: <code>list_projects</code> · <code>list_notes</code> · <code>get_fix_prompt</code> ·{" "}
            <code>resolve_notes</code> · <code>set_status</code> · <code>add_comment</code>. Typical ask:{" "}
            <i>“Pull my new KryMark feedback and fix all of it, then resolve the notes.”</i> Plain HTTP works
            too (CLI/curl): POST JSON-RPC to the same URL with the same header.
          </p>
        </div>

        <div className="doc-section" style={{ borderBottom: 0 }}>
          <h2>Checks &amp; gotchas</h2>
          <p>
            · The tab shows on every page the snippet is on — reviewers don’t sign up or install anything.<br />
            · If you set a domain on the project, notes are only accepted from that domain (leave it
            empty while testing).<br />
            · Screenshots are best-effort: on cross-origin iframes the note still arrives with full
            DOM context — that’s the part the AI needs.<br />
            · Send a test note yourself first: your project page shows it within seconds.
          </p>
        </div>

        <footer>
          <span>© {new Date().getFullYear()} KryMark</span>
          <Link href="/">← Home</Link>
        </footer>
      </div>
    </div>
  );
}
