// Archetype: A Dashboard · dark (Kry UI)
"use client";

import { useActionState } from "react";
import { createProject } from "./actions";

export function CreateProjectForm() {
  const [error, formAction, pending] = useActionState(createProject, null);
  return (
    <form action={formAction} className="create-form">
      <input name="name" placeholder="Project name (e.g. bakery website)" required maxLength={80} />
      <input name="domains" placeholder="Domain (e.g. myshop.lovable.app) — empty = accept anywhere" />
      <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} disabled={pending}>
        {pending ? "Creating..." : "Create project"}
      </button>
      {error && <p className="auth-err" style={{ width: "100%" }}>{error}</p>}
    </form>
  );
}
