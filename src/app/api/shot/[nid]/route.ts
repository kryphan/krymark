import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/pb";

// PB is internal-only → dashboard images must be proxied. Access check runs through the
// USER client (rules), then the file is streamed from PB inside the docker network.
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ nid: string }> }) {
  const { nid } = await ctx.params;
  const pb = await createClient();
  if (!pb.authStore.isValid) return new NextResponse(null, { status: 401 });

  let snap;
  try {
    // viewRule enforces org membership — cross-org returns 404 here
    snap = await pb.collection("note_snapshots").getFirstListItem(`note="${nid.replace(/"/g, "")}"`);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  // Ảnh mới nằm S3 public → redirect thẳng (list/detail/thumb dùng chung endpoint này)
  if (snap.screenshot_url) return NextResponse.redirect(snap.screenshot_url, 302);
  if (!snap.screenshot) return new NextResponse(null, { status: 404 });

  const fileUrl = `${process.env.PB_URL ?? "http://127.0.0.1:8090"}/api/files/${snap.collectionId}/${snap.id}/${snap.screenshot}`;
  const upstream = await fetch(fileUrl);
  if (!upstream.ok) return new NextResponse(null, { status: 404 });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
