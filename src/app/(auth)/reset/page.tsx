// Archetype: A Dashboard · dark (Kry UI)
"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { confirmPasswordReset } from "../actions";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [error, formAction, pending] = useActionState(confirmPasswordReset, null);
  if (!token) {
    return (
      <p className="sub">
        This reset link is missing its token — open the link from the email again, or{" "}
        <Link href="/forgot">request a new one</Link>.
      </p>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <label htmlFor="password">New password (≥8 characters)</label>
      <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      <label htmlFor="password2">Repeat new password</label>
      <input id="password2" name="password2" type="password" required minLength={8} autoComplete="new-password" />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving..." : "Set new password"}
      </button>
      {error && <p className="auth-err">{error}</p>}
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="auth-card">
      <h1>Choose a new password</h1>
      <p className="sub">KryMark account recovery.</p>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
