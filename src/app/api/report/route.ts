import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb-admin";
import { hashIp, checkIpLimit, checkProjectLimit, maybeSweep } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/notify";
import { classifyNote } from "@/lib/tags";
import { appOrigin } from "@/lib/origin";
import { fireWebhook } from "@/lib/webhook";

// POST /api/report — cửa ẩn danh DUY NHẤT (system-design §5).
// Thứ tự: ① rate-limit IP ② cap size ③ lookup project ④ origin (lớp UX) ⑤ cap dom_html
// ⑥ insert note+snapshot ⑦ ảnh best-effort. Origin KHÔNG phải lá chắn spam (D3').
export const runtime = "nodejs";

const MAX_BODY = 900 * 1024;       // D11/C10 — reject sớm theo Content-Length
const MAX_DOM = 64 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const j = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  maybeSweep();

  // ① rate-limit theo IP (hash — D12, không giữ IP raw)
  const ip = (req.headers.get("x-forwarded-for") ?? "0.0.0.0").split(",")[0].trim();
  const hip = hashIp(ip);
  if (!checkIpLimit(hip)) return j({ ok: false }, 429);

  // ② cap kích thước trước khi đọc body
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return j({ ok: false }, 413);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return j({ ok: false }, 400);
  }
  const widgetKey = String(body.widget_key ?? "");
  const selector = String(body.selector ?? "").slice(0, 1000);
  const comment = String(body.comment ?? "").slice(0, 5000);
  if (!widgetKey || !selector || !comment) return j({ ok: false }, 400);

  // ③ lookup project
  const pb = pbAdmin();
  let project;
  try {
    project = await pb
      .collection("projects")
      .getFirstListItem(`widget_key="${widgetKey.replace(/"/g, "")}"`);
  } catch {
    return j({ ok: false }, 404);
  }

  // ④ origin check — LỚP UX (suffix match qua URL parser, không string-contains — C6)
  const domains: string[] = Array.isArray(project.domains) ? project.domains : [];
  if (domains.length > 0) {
    let host = "";
    try {
      host = new URL(req.headers.get("origin") ?? "").hostname;
    } catch {
      /* origin thiếu/hỏng → coi như fail bên dưới */
    }
    const okOrigin = domains.some((d) => {
      const dom = String(d).trim().toLowerCase().replace(/^\*\./, "");
      return host === dom || host.endsWith(`.${dom}`);
    });
    if (!okOrigin) return j({ ok: false }, 403);
  }

  // cap theo project/ngày (lá chắn thật thứ 2 — D9)
  if (!checkProjectLimit(project.id)) return j({ ok: false }, 429);

  // ⑥ insert notes + note_snapshots (superuser). PB không có transaction qua API →
  // snapshot fail = xoá note vừa tạo rồi báo lỗi (widget cho retry).
  let noteId = "";
  try {
    const note = await pb.collection("notes").create({
      project: project.id,
      status: "new",
      selector,
      dom_text: String(body.dom_text ?? "").slice(0, 400),
      comment,
      meta: body.meta ?? {},
      tags: classifyNote(comment, String(body.dom_text ?? "")),
      reporter_name: body.reporter_name ? String(body.reporter_name).slice(0, 120) : "",
      reporter_email: body.reporter_email ? String(body.reporter_email).slice(0, 160) : "",
    });
    noteId = note.id;

    const form = new FormData();
    form.set("note", noteId);
    form.set("dom_html", String(body.dom_html ?? "").slice(0, MAX_DOM));
    form.set("computed_style", JSON.stringify(body.computed_style ?? {}));
    form.set("position", JSON.stringify(body.position ?? {}));

    // ⑦ ảnh best-effort — dataURL → S3 public (link đính vào AI prompt);
    // S3 fail → fallback lưu file PB như cũ. Hỏng/quá cap thì bỏ, note vẫn sống.
    const shot = typeof body.screenshot === "string" ? body.screenshot : "";
    const m = shot.match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/);
    if (m) {
      try {
        const buf = Buffer.from(m[2], "base64");
        if (buf.length <= 1000000) {
          const { uploadShot } = await import("@/lib/s3");
          const url = await uploadShot(buf, m[1]);
          if (url) form.set("screenshot_url", url);
          else form.set("screenshot", new Blob([new Uint8Array(buf)], { type: m[1] }), "shot.webp");
        }
      } catch {
        /* bỏ ảnh */
      }
    }
    await pb.collection("note_snapshots").create(form);
  } catch {
    if (noteId) await pb.collection("notes").delete(noteId).catch(() => {});
    return j({ ok: false }, 500);
  }

  // báo Telegram fire-and-forget — không chặn response của widget
  const metaUrl = (body.meta as { url?: string } | undefined)?.url ?? "";
  const origin = appOrigin();
  notifyTelegram(
    `◉ KryMark — note mới ở ${project.name}\n"${comment.slice(0, 160)}"\n${metaUrl}\n→ ${origin}/p/${project.id}/n/${noteId}`
  );

  return j({ ok: true, note_id: noteId });
}
