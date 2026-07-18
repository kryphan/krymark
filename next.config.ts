import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Next 16 default false — bật để build lại chỉ compile phần đổi (KryDeploy v3)
    turbopackFileSystemCacheForBuild: true,
  },
  async headers() {
    return [
      {
        // widget assets load từ site khách (cross-origin): w.js là <script> thường (không cần),
        // nhưng /vendor/*.mjs đi qua dynamic import() → BẮT BUỘC CORS, thiếu là self-host fail
        source: "/vendor/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
