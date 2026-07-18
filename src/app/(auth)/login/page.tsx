// Archetype: A Dashboard · dark (Kry UI) — app auxiliary screen, same language as dashboard
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);
  return (
    <main className="auth-card">
      <h1>Log in</h1>
      <p className="sub">KryMark — your feedback translation chamber.</p>
      <form action={formAction}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn-primary" disabled={pending}>
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
      {error && <p className="auth-err">{error}</p>}
      <p className="auth-alt">
        No account yet? <Link href="/signup">Sign up</Link> · <Link href="/forgot">Forgot password?</Link>
      </p>
    </main>
  );
}
