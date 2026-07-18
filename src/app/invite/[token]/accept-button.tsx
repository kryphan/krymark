"use client";

import { useActionState } from "react";
import { acceptInvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(acceptInvite.bind(null, token), null);
  return (
    <form action={formAction}>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Joining..." : "Accept invite"}
      </button>
      {error && <p className="auth-err">{error}</p>}
    </form>
  );
}
