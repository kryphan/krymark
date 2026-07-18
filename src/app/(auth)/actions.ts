"use server";

import { redirect } from "next/navigation";
import { createClient, persistAuth, clearAuth } from "@/lib/pb";

// Org auto-create is NOT here — pb_hooks/main.pb.js handles it on user create (D7).

export async function login(_prev: string | null, formData: FormData) {
  const pb = await createClient();
  try {
    await pb
      .collection("users")
      .authWithPassword(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  } catch {
    return "Wrong email or password.";
  }
  await persistAuth(pb);
  redirect("/projects");
}

export async function signup(_prev: string | null, formData: FormData) {
  const pb = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return "Password needs at least 8 characters.";
  try {
    await pb.collection("users").create({ email, password, passwordConfirm: password });
    await pb.collection("users").authWithPassword(email, password);
  } catch {
    return "Couldn't sign up — try another email or try again.";
  }
  await persistAuth(pb);
  redirect("/projects");
}

export async function logout() {
  await clearAuth();
  redirect("/login");
}

// ---- Quên mật khẩu: token tự quản (password_resets admin-only) + email qua SES API ----
// KHÔNG lộ email có tồn tại hay không — luôn trả cùng 1 câu.

export async function requestPasswordReset(_prev: string | null, formData: FormData) {
  const { randomBytes } = await import("crypto");
  const { pbAdmin } = await import("@/lib/pb-admin");
  const { sendPasswordResetEmail } = await import("@/lib/email");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const DONE = "If that email has an account, a reset link is on its way. Check your inbox (and spam).";
  if (!email.includes("@")) return DONE;

  try {
    const admin = pbAdmin();
    await admin.collection("users").getFirstListItem(`email="${email.replace(/"/g, "")}"`); // ném nếu không có
    const token = randomBytes(24).toString("hex");
    await admin.collection("password_resets").create({
      email,
      token,
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
    await sendPasswordResetEmail(email, `${origin}/reset?token=${token}`);
  } catch {
    /* user không tồn tại / lỗi gửi — vẫn trả DONE, không lộ gì */
  }
  return DONE;
}

export async function confirmPasswordReset(_prev: string | null, formData: FormData) {
  const { pbAdmin } = await import("@/lib/pb-admin");
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  if (password.length < 8) return "Password needs at least 8 characters.";
  if (password !== password2) return "The two passwords don't match.";

  const admin = pbAdmin();
  let reset;
  try {
    reset = await admin.collection("password_resets").getFirstListItem(`token="${token.replace(/"/g, "")}"`);
  } catch {
    return "This reset link is invalid or already used — request a new one.";
  }
  if (new Date(reset.expires) <= new Date()) {
    await admin.collection("password_resets").delete(reset.id).catch(() => {});
    return "This reset link has expired — request a new one.";
  }
  try {
    const user = await admin.collection("users").getFirstListItem(`email="${String(reset.email).replace(/"/g, "")}"`);
    await admin.collection("users").update(user.id, { password, passwordConfirm: password });
  } catch {
    return "Couldn't reset the password — request a new link.";
  }
  await admin.collection("password_resets").delete(reset.id).catch(() => {});
  redirect("/login");
}
