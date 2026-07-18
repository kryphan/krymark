// Archetype: A Dashboard · dark (Kry UI)
"use client";

import { useActionState, useTransition } from "react";
import { createInvite, revokeInvite, regenerateApiKey } from "./actions";

export function InviteForm() {
  const [error, formAction, pending] = useActionState(createInvite, null);
  return (
    <form action={formAction} className="create-form">
      <input name="email" type="email" placeholder="teammate@email.com" required />
      <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} disabled={pending}>
        {pending ? "Creating..." : "Create invite link"}
      </button>
      {error && <p className="auth-err" style={{ width: "100%" }}>{error}</p>}
    </form>
  );
}

export function RevokeButton({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="danger-link" disabled={pending} onClick={() => start(() => revokeInvite(inviteId))}>
      Revoke
    </button>
  );
}

export function RegenKeyButton({ hasKey }: { hasKey: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm"
      disabled={pending}
      onClick={() => {
        if (!hasKey || confirm("Regenerate the API key? AI clients using the old key stop working."))
          start(() => regenerateApiKey());
      }}
    >
      {pending ? "Working…" : hasKey ? "Regenerate key" : "Generate API key"}
    </button>
  );
}
