// LDP TẮT (Dang chốt 2026-07-17: dùng nội bộ trước, chưa cần landing).
// Bản landing warm nằm ở git history (v0.9.0) — cần mở lại thì restore.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const authed = (await cookies()).has("pb_auth");
  redirect(authed ? "/projects" : "/login");
}
