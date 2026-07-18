import PocketBase, { type AuthRecord } from "pocketbase";
import { cookies } from "next/headers";

// PB chạy INTERNAL (cùng docker network) — không expose public. D1 giữ nguyên:
// widget → /api/report (Next, superuser token) → PB. Dashboard → PB qua rules đa-tenant.
const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
export const AUTH_COOKIE = "pb_auth";

export async function createClient(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  const raw = (await cookies()).get(AUTH_COOKIE)?.value;
  if (raw) {
    try {
      const { token, record } = JSON.parse(raw) as { token: string; record: AuthRecord };
      pb.authStore.save(token, record);
    } catch {
      // cookie hỏng → coi như chưa đăng nhập
    }
  }
  return pb;
}

export async function persistAuth(pb: PocketBase) {
  (await cookies()).set(
    AUTH_COOKIE,
    JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }
  );
}

export async function clearAuth() {
  (await cookies()).delete(AUTH_COOKIE);
}
