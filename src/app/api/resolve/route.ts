import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb-admin";

// Public — extension dán link project (/p/<id> hoặc /r/<key>) → trả widget_key.
// widget_key vốn public (nằm trong snippet mọi site dùng widget), không phải secret.
export const runtime = "nodejs";
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("p") ?? "").replace(/[^a-z0-9]/gi, "");
  const key = (req.nextUrl.searchParams.get("key") ?? "").replace(/[^a-z0-9]/gi, "");
  try {
    const pb = pbAdmin();
    const p = id
      ? await pb.collection("projects").getOne(id)
      : await pb.collection("projects").getFirstListItem(`widget_key="${key}"`);
    return NextResponse.json({ widget_key: p.widget_key, name: p.name }, { headers: CORS });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404, headers: CORS });
  }
}
