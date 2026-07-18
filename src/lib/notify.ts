// Telegram notify — fire-and-forget, note mới báo Dang liền (nội bộ).
// Thiếu env → im lặng. KHÔNG await chặn response của widget.
export function notifyTelegram(text: string): void {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}
