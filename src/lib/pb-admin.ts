import PocketBase from "pocketbase";

// Client SUPERUSER — CHỈ /api/report dùng (D1). Token impersonate dài hạn trong .env.
// KHÔNG bao giờ import file này vào code chạy phía user/dashboard.
let cached: PocketBase | null = null;

export function pbAdmin(): PocketBase {
  if (cached) return cached;
  const pb = new PocketBase(process.env.PB_URL ?? "http://127.0.0.1:8090");
  const token = process.env.PB_SUPERUSER_TOKEN;
  if (!token) throw new Error("PB_SUPERUSER_TOKEN chưa cấu hình");
  pb.authStore.save(token, null);
  pb.autoCancellation(false); // nhiều request song song, đừng tự huỷ
  cached = pb;
  return pb;
}
