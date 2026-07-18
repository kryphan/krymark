import { NextResponse, type NextRequest } from "next/server";

// Chỉ check CÓ cookie phiên hay không (nhẹ, edge-safe) — token thật do server page
// validate với PocketBase; token stale sẽ bị /projects redirect về /login.
// Rate-limit /api/report KHÔNG nằm đây — nằm trong route handler (GĐ1).
const PROTECTED = ["/projects"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasAuth = request.cookies.has("pb_auth");
  if (!hasAuth && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
