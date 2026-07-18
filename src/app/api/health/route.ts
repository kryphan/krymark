import { NextResponse } from "next/server";

// Health check — reliability baseline (Project Lifecycle): app sống + PB sống.
// KryWatch/Uptime Kuma gõ endpoint này.
export const runtime = "nodejs";

export async function GET() {
  let pbOk = false;
  try {
    const res = await fetch(`${process.env.PB_URL ?? "http://127.0.0.1:8090"}/api/health`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    pbOk = res.ok;
  } catch {
    /* pb down */
  }
  return NextResponse.json(
    { ok: pbOk, app: true, pb: pbOk },
    { status: pbOk ? 200 : 503 }
  );
}
