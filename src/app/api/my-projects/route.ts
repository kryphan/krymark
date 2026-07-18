import { NextResponse } from "next/server";
import { createClient } from "@/lib/pb";
import { resolveOrgs } from "@/lib/org";

// Extension gọi endpoint này QUA tab dashboard (cùng origin) → cookie phiên tự gửi.
// Không cần API key, không dính third-party cookie. SameSite=Lax chặn CSRF fetch cross-site.
export const runtime = "nodejs";

export async function GET() {
  const pb = await createClient();
  if (!pb.authStore.isValid) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  try {
    const { activeId } = await resolveOrgs(pb);
    const projects = await pb.collection("projects").getFullList({
      filter: activeId ? `org="${activeId}"` : "",
      sort: "-created",
      fields: "id,name,widget_key",
    });
    return NextResponse.json({ projects: projects.map((p) => ({ id: p.id, name: p.name, widget_key: p.widget_key })) });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
