// Archetype: A Dashboard · dark (Kry UI)
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";

export default function ForgotPage() {
  const [msg, formAction, pending] = useActionState(requestPasswordReset, null);
  return (
    <main className="auth-card">
      <h1>Reset password</h1>
      <p className="sub">Enter your account email — we’ll send a reset link.</p>
      {msg ? (
        <>
          <p style={{ fontSize: 14 }}>{msg}</p>
          <p className="auth-alt">
            <Link href="/login">Back to login</Link>
          </p>
        </>
      ) : (
        <form action={formAction}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <button className="btn-primary" disabled={pending}>
            {pending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      {!msg && (
        <p className="auth-alt">
          <Link href="/login">Back to login</Link>
        </p>
      )}
    </main>
  );
}
