// Archetype: A Dashboard · dark (Kry UI)
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-card" style={{ textAlign: "center" }}>
      <p className="mono" style={{ color: "var(--mark)", fontSize: 13, margin: "0 0 8px" }}>◉ 404</p>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>This page doesn’t exist</h1>
      <p className="sub">The mark points at nothing here.</p>
      <Link href="/" className="btn-ghost" style={{ textDecoration: "none" }}>
        ← Back home
      </Link>
    </main>
  );
}
