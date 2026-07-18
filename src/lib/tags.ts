// Taxonomy tag — AI tự phân loại lúc note vào (heuristic v1, VI+EN, zero-dependency;
// nâng LLM sau nếu heuristic tỏ ra cùn). Reporter KHÔNG phải chọn gì (giữ ma sát = 0);
// dashboard sửa được tag ở detail.

export const TAGS: Record<string, { label: string }> = {
  "ui-layout": { label: "Layout" },
  "text-copy": { label: "Copy" },
  "color-style": { label: "Style" },
  bug: { label: "Bug" },
  missing: { label: "Missing" },
  other: { label: "Other" },
};

const RULES: [string, RegExp][] = [
  // bug hành vi — ưu tiên cao nhất (đè các loại khác)
  ["bug", /không (bấm|nhấn|click|chạy|hoạt động|load|mở|gửi)|bị lỗi|error|broken|crash|doesn'?t work|not working|can'?t (click|open|submit)|404|blank|trắng trang/i],
  // thiếu nội dung / đòi thêm
  ["missing", /thiếu|chưa có|bổ sung|thêm (vào|phần|mục|nút|ảnh|thông tin)|missing|add (a|the|more)|cần thêm|đâu rồi/i],
  // chữ nghĩa
  ["text-copy", /chữ|chính tả|sai (tên|số|giá|thông tin)|đổi (chữ|tên|chữ nghĩa)|wording|typo|text|viết lại|câu (này|chữ)|dịch|translate|spelling|đổi.*(tên|title)|update.*(name|text)/i],
  // màu / đậm nhạt / nhìn
  ["color-style", /màu|đậm|nhạt|khó (thấy|đọc|nhìn)|nổi bật|contrast|color|colour|bold|font|chữ (to|nhỏ)|mờ|sáng|tối|đẹp|xấu/i],
  // vị trí / kích thước / căn
  ["ui-layout", /lệch|tràn|căn|vị trí|xuống dòng|đè|chồng|overlap|align|layout|to quá|nhỏ quá|rộng|hẹp|khoảng cách|spacing|margin|padding|resize|move|dời|đẩy (lên|xuống|qua)|kéo (lên|xuống)|size/i],
];

export function classifyNote(comment: string, domText?: string): string[] {
  const hay = `${comment} ${domText ?? ""}`;
  for (const [tag, re] of RULES) if (re.test(hay)) return [tag];
  return ["other"];
}
