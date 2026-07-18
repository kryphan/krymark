import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb-admin";

// Public — widget hỏi ngôn ngữ theo widget_key (key vốn public). CORS mở, cache nhẹ.
export const runtime = "nodejs";
const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get("key") ?? "").replace(/[^a-z0-9]/gi, "");
  if (!key) return NextResponse.json({ lang: "en" }, { headers: CORS });
  try {
    const p = await pbAdmin().collection("projects").getFirstListItem(`widget_key="${key}"`);
    return NextResponse.json({ lang: p.default_lang === "vi" ? "vi" : "en", name: p.name }, { headers: CORS });
  } catch {
    return NextResponse.json({ lang: "en" }, { headers: CORS });
  }
}
