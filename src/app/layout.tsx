// Archetype: A Dashboard · dark (Kry UI) — theo docs/design-direction.md
// (dashboard = "buồng biên dịch" dark; widget nhúng sẽ light — 2 đầu đường ống)
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000"),
  // Widget dò meta này để KHÔNG tự chạy trên bất kỳ trang KryMark nào (mọi instance).
  other: { "krymark-app": "1" },
  title: { default: "KryMark — feedback that becomes an AI prompt", template: "%s · KryMark" },
  description:
    "Client feedback on your vibecoded site, delivered as a DOM-rich AI prompt you paste into Cursor, Lovable or Claude. One script tag, no SDK.",
  openGraph: {
    title: "KryMark — feedback that becomes an AI prompt",
    description:
      "Non-coders click the spot and type. You get an AI prompt that fixes it. Built for Lovable, Bolt, v0 and Cursor sites.",
    siteName: "KryMark",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
