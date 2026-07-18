import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/pb";
import { resolveOrgs } from "@/lib/org";
import { appOrigin } from "@/lib/origin";

// Tạo project — gọi qua tab dashboard (cùng origin, cookie tự gửi). SameSite=Lax chặn CSRF.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const pb = await createClient();
  if (!pb.authStore.isValid) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  let body: { name?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  try {
    const { activeId } = await resolveOrgs(pb);
    const project = await pb.collection("projects").create({
      org: activeId,
      name,
      widget_key: randomBytes(12).toString("hex"),
      domains: [],
      default_lang: body.lang === "vi" ? "vi" : "en",
      settings: {},
    });
    const origin = appOrigin();
    return NextResponse.json({
      id: project.id, name: project.name, widget_key: project.widget_key, review_link: `${origin}/r/${project.widget_key}`,
    });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
