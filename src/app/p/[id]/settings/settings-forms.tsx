// Archetype: A Dashboard · dark (Kry UI)
"use client";

import { useActionState, useTransition } from "react";
import { updateProject, regenerateKey, deleteProject, testWebhook } from "./actions";
import { useState } from "react";

export function UpdateForm({
  projectId, name, domains, lang, webhookUrl, webhookSecret,
}: { projectId: string; name: string; domains: string[]; lang: string; webhookUrl: string; webhookSecret: string }) {
  const [error, formAction, pending] = useActionState(updateProject.bind(null, projectId), null);
  const [testMsg, setTestMsg] = useState("");
  return (
    <form action={formAction} className="create-form" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <label style={{ fontSize: 13, color: "var(--text-dim)" }}>Project name</label>
      <input name="name" defaultValue={name} required maxLength={80} />
      <label style={{ fontSize: 13, color: "var(--text-dim)" }}>
        Allowed domains (comma-separated; empty = accept notes from anywhere)
      </label>
      <input name="domains" defaultValue={domains.join(", ")} placeholder="myshop.lovable.app, myshop.com" />

      <label style={{ fontSize: 13, color: "var(--text-dim)" }}>Widget language (what reviewers see)</label>
      <select name="default_lang" defaultValue={lang} style={{ padding: "9px 11px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, maxWidth: 200 }}>
        <option value="en">English</option>
        <option value="vi">Tiếng Việt</option>
      </select>

      <label style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
        Webhook URL <span style={{ color: "var(--text-3)" }}>— POST note events (n8n / Slack / ClickUp / Zapier)</span>
      </label>
      <input name="webhook_url" defaultValue={webhookUrl} placeholder="https://n8n.example.com/webhook/…" />
      <label style={{ fontSize: 13, color: "var(--text-dim)" }}>Webhook secret (optional — HMAC signs the payload)</label>
      <input name="webhook_secret" defaultValue={webhookSecret} placeholder="whatever-you-want" />

      <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button type="button" className="btn-ghost" onClick={async () => setTestMsg(await testWebhook(projectId))}>
          Send test event
        </button>
        {testMsg && <span style={{ fontSize: 12, color: "var(--ok)" }}>{testMsg}</span>}
      </div>
      {error && <p className="auth-err">{error}</p>}
    </form>
  );
}

export function DangerZone({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() => {
          if (confirm("Regenerate the widget key?\n\nThe snippet already pasted on sites will STOP working until you replace it with the new one.")) {
            start(() => regenerateKey(projectId));
          }
        }}
      >
        Regenerate widget key
      </button>
      <button
        className="danger-link"
        disabled={pending}
        onClick={() => {
          const typed = prompt(`Delete this project and ALL its notes permanently?\n\nType the project name to confirm: ${projectName}`);
          if (typed === projectName) start(() => deleteProject(projectId));
        }}
      >
        Delete project
      </button>
    </div>
  );
}
