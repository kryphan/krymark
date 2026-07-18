// Archetype: A Dashboard · dark (Kry UI) — app auxiliary screen, same language as dashboard
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";

export default function SignupPage() {
  const [error, formAction, pending] = useActionState(signup, null);
  return (
    <main className="auth-card">
      <h1>Create account</h1>
      <p className="sub">Sign up and get your own workspace — no setup needed.</p>
      <form action={formAction}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password (≥8 characters)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <button className="btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Sign up"}
        </button>
      </form>
      {error && <p className="auth-err">{error}</p>}
      <p className="auth-alt">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
