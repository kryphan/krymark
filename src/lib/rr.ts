import { createHmac } from "crypto";

// Re-review (#10 — khép vòng trọn): email resolved kèm link để REPORTER xác nhận
// "đúng ý rồi" hay "chưa được". Token = noteId + HMAC (không cần bảng mới, không login).
const salt = () => process.env.IP_HASH_SALT ?? "dev-salt";

export function rrSign(noteId: string): string {
  return createHmac("sha256", `rr:${salt()}`).update(noteId).digest("hex").slice(0, 20);
}

export function rrVerify(token: string): string | null {
  const [noteId, sig] = token.split(".");
  if (!noteId || !sig) return null;
  return rrSign(noteId) === sig ? noteId : null;
}

export function rrUrl(noteId: string, ok: boolean): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  return `${origin}/api/rr?t=${noteId}.${rrSign(noteId)}&ok=${ok ? 1 : 0}`;
}
