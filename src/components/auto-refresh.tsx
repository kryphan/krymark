"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Note mới tự hiện — poll nhẹ khi tab đang nhìn (không SSE cho đỡ moving parts)
export function AutoRefresh({ ms = 15000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
