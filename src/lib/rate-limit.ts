import { createHash } from "crypto";

// D9 — lá chắn spam THẬT của /api/report (origin-lock chỉ là lớp UX, D3').
// In-memory sliding window: đủ cho ≤ vài chục org, 1 instance (challenger C2).
// GĐ1 gọi từ route handler. Nếu scale nhiều instance → chuyển fixed-window bucket Postgres.

type Stamp = number[];
const ipWindow = new Map<string, Stamp>(); // hashIP → timestamps trong 60s
const projectDay = new Map<string, { day: string; count: number }>();

const PER_IP_MIN = Number(process.env.RATE_LIMIT_PER_IP_MIN ?? 10);
const PER_PROJECT_DAY = Number(process.env.RATE_LIMIT_PER_PROJECT_DAY ?? 500);

// D12 — KHÔNG lưu/so IP raw. Hash + salt, chỉ sống trong memory.
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "dev-salt"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export function checkIpLimit(hashedIp: string, now = Date.now()): boolean {
  const windowStart = now - 60_000;
  const stamps = (ipWindow.get(hashedIp) ?? []).filter((t) => t > windowStart);
  if (stamps.length >= PER_IP_MIN) {
    ipWindow.set(hashedIp, stamps);
    return false;
  }
  stamps.push(now);
  ipWindow.set(hashedIp, stamps);
  return true;
}

export function checkProjectLimit(projectId: string, now = Date.now()): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  const entry = projectDay.get(projectId);
  if (!entry || entry.day !== day) {
    projectDay.set(projectId, { day, count: 1 });
    return true;
  }
  if (entry.count >= PER_PROJECT_DAY) return false;
  entry.count += 1;
  return true;
}

// Dọn map định kỳ để không phình memory (gọi lười ở mỗi request thứ ~1000)
let calls = 0;
export function maybeSweep(now = Date.now()) {
  if (++calls % 1000 !== 0) return;
  const windowStart = now - 60_000;
  for (const [k, stamps] of ipWindow) {
    const live = stamps.filter((t) => t > windowStart);
    if (live.length === 0) ipWindow.delete(k);
    else ipWindow.set(k, live);
  }
  const day = new Date(now).toISOString().slice(0, 10);
  for (const [k, v] of projectDay) if (v.day !== day) projectDay.delete(k);
}
