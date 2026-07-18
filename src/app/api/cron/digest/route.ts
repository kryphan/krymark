import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb-admin";
import { sendDigestEmail } from "@/lib/email";
import { appOrigin } from "@/lib/origin";

// Weekly digest — host cron gọi: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/digest
// Mỗi org → owner nhận 1 mail tổng (note mới 7 ngày + tổng chưa xử lý). Skip nếu SES/CRON_SECRET off.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const pb = pbAdmin();
  const origin = appOrigin();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let sent = 0;

  const orgs = await pb.collection("orgs").getFullList();
  for (const org of orgs) {
    // owner email
    let ownerEmail = "";
    try {
      const owner = await pb.collection("members").getFirstListItem(`org="${org.id}" && role="owner"`, { expand: "user" });
      ownerEmail = (owner.expand?.user as { email?: string })?.email ?? "";
    } catch {
      continue;
    }
    if (!ownerEmail) continue;

    const projects = await pb.collection("projects").getFullList({ filter: `org="${org.id}"`, fields: "id,name" });
    const lines: string[] = [];
    for (const p of projects) {
      const fresh = await pb.collection("notes").getList(1, 1, {
        filter: `project="${p.id}" && created>="${weekAgo}" && deleted=null`,
      });
      const open = await pb.collection("notes").getList(1, 1, {
        filter: `project="${p.id}" && (status="new" || status="in_progress") && deleted=null`,
      });
      if (fresh.totalItems > 0 || open.totalItems > 0) {
        lines.push(`• ${p.name}: ${fresh.totalItems} new this week, ${open.totalItems} still open`);
      }
    }
    if (lines.length && (await sendDigestEmail({ to: ownerEmail, orgName: org.name, lines, origin }))) sent++;
  }
  return NextResponse.json({ ok: true, digests_sent: sent });
}
