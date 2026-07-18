import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

// Ảnh note → S3 public (prefix shots/, key ngẫu nhiên không đoán được) để ĐÍNH LINK
// vào AI prompt (Dang chốt 2026-07-17). Best-effort: S3 fail → caller fallback PB file.
// Gotcha: SDK v3 mới tự thêm checksum header gây 403 với 1 số policy → WHEN_REQUIRED.
let client: S3Client | null = null;
function s3(): S3Client | null {
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) return null;
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION ?? "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

// Xoá note vĩnh viễn → dọn luôn object S3 (best-effort, không chặn flow xoá)
export async function deleteShot(url: string): Promise<void> {
  const c = s3();
  const bucket = process.env.S3_BUCKET;
  if (!c || !bucket || !url.includes(`${bucket}.s3.`)) return;
  const key = url.split(".amazonaws.com/")[1];
  if (!key?.startsWith("shots/")) return;
  await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
}

export async function uploadShot(buf: Buffer, contentType: string): Promise<string | null> {
  const c = s3();
  const bucket = process.env.S3_BUCKET;
  if (!c || !bucket) return null;
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
  const key = `shots/${randomBytes(16).toString("hex")}.${ext}`;
  try {
    await c.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `https://${bucket}.s3.${process.env.S3_REGION ?? "ap-southeast-1"}.amazonaws.com/${key}`;
  } catch {
    return null;
  }
}
