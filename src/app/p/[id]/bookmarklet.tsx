"use client";

import { useEffect, useRef } from "react";

// No-code option 1: bookmarklet — kéo vào bookmark bar, bấm trên BẤT KỲ trang nào.
// href javascript: phải set qua ref (React chặn/cảnh báo protocol này trong JSX).
export function Bookmarklet({ origin, widgetKey, name }: { origin: string; widgetKey: string; name: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const code = `(()=>{var d=document,s=d.createElement('script');s.src='${origin}/w.js?'+Date.now();s.setAttribute('data-key','${widgetKey}');d.body.appendChild(s)})()`;
    ref.current?.setAttribute("href", `javascript:${code}`);
  }, [origin, widgetKey]);
  return (
    <a
      ref={ref}
      className="btn-ghost"
      style={{ textDecoration: "none", cursor: "grab" }}
      onClick={(e) => e.preventDefault()}
      title="Drag me to your bookmarks bar, then click it on any page"
    >
      ◉ Review: {name}
    </a>
  );
}
