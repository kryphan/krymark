// Origin của app — self-host set NEXT_PUBLIC_APP_ORIGIN trong .env (bắt buộc khi chạy thật).
export const appOrigin = (): string =>
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
