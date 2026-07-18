import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb-admin";
import { rrVerify } from "@/lib/rr";
import { notifyTelegram } from "@/lib/notify";
import { appOrigin } from "@/lib/origin";

// Re-review công khai (từ email reporter) — token HMAC, không login.
// ok=1 → ghi nhận 👍 · ok=0 → form nhỏ → note quay lại in_progress + comment + Telegram.
export const runtime = "nodejs";

const page = (title: string, body: string) => new NextResponse(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · KryMark</title>
<body style="margin:0;background:#0d0d0f;color:#f2f2f3;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px">
<div style="max-width:420px;width:100%;background:#1b1b1e;border:1px solid #2c2c31;border-radius:12px;padding:28px">
<p style="font-family:monospace;color:#ff5a3c;font-size:11px;letter-spacing:.15em;margin:0 0 10px">◉ KRYMARK</p>
${body}</div></body>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } }
);

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = req.nextUrl.searchParams.get("ok") === "1";
  const noteId = rrVerify(t);
  if (!noteId) return page("Invalid link", `<h2 style="margin:0">This link is invalid</h2><p style="color:#8f8f96">It may have been truncated by your email app.</p>`);

  const pb = pbAdmin();
  let note;
  try {
    note = await pb.collection("notes").getOne(noteId);
  } catch {
    return page("Gone", `<h2 style="margin:0">This feedback no longer exists</h2>`);
  }

  if (ok) {
    await pb.collection("comments").create({
      note: noteId, author_type: "system", body: "✅ Reporter confirmed the fix looks right (via email re-review).",
    }).catch(() => {});
    return page("Thanks!", `<h2 style="margin:0 0 8px">Great — thanks for confirming! ✓</h2><p style="color:#8f8f96;margin:0">"${String(note.comment).slice(0, 140)}"</p>`);
  }

  return page("Tell us more", `
<h2 style="margin:0 0 8px">Not quite right yet?</h2>
<p style="color:#8f8f96;margin:0 0 14px">Your original note: "${String(note.comment).slice(0, 140)}"</p>
<form method="POST" action="/api/rr">
<input type="hidden" name="t" value="${t}">
<textarea name="msg" required maxlength="1000" placeholder="What still needs changing?" style="width:100%;box-sizing:border-box;min-height:90px;background:#0d0d0f;border:1px solid #2c2c31;border-radius:8px;color:#f2f2f3;padding:10px;font-size:15px"></textarea>
<button style="margin-top:12px;width:100%;padding:11px;background:#ff3d2e;border:0;border-radius:8px;color:#fff;font-weight:600;font-size:14px;cursor:pointer">Send to the team</button>
</form>`);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const noteId = rrVerify(String(form.get("t") ?? ""));
  const msg = String(form.get("msg") ?? "").trim().slice(0, 1000);
  if (!noteId || !msg) return page("Invalid", `<h2 style="margin:0">Something went wrong</h2>`);

  const origin = appOrigin();
  const pb = pbAdmin();
  try {
    const note = await pb.collection("notes").getOne(noteId);
    await pb.collection("notes").update(noteId, { status: "in_progress", reporter_emailed_at: "" }); // mở lại + cho phép email đợt sau
    await pb.collection("comments").create({
      note: noteId, author_type: "system", body: `🔁 Reporter says it's not right yet (via re-review): "${msg}"`,
    });
    notifyTelegram(`◉ KryMark — reporter CHƯA ưng fix:\n"${note.comment}"\n→ "${msg}"\n${origin}/p/${note.project}/n/${noteId}`);
  } catch {
    return page("Gone", `<h2 style="margin:0">This feedback no longer exists</h2>`);
  }
  return page("Sent", `<h2 style="margin:0 0 8px">Sent to the team ✓</h2><p style="color:#8f8f96;margin:0">They'll take another look.</p>`);
}
