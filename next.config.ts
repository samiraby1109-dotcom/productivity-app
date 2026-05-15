import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA handled via public/sw.js (custom service worker)
  // No Prisma; using Supabase JS client server-side
  serverExternalPackages: [],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // 'unsafe-inline' kept because Next.js 15 injects inline bootstrap
            // scripts. Dropped 'unsafe-eval' since argon2-browser WASM (the
            // original reason) is no longer in the dependency tree.
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' blob: data:",
            "media-src 'self' blob:",
            "connect-src 'self' https://*.supabase.co",
            "font-src 'self'",
            "object-src 'none'",
            "frame-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
