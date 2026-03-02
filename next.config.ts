import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA handled via public/sw.js (custom service worker)
  // No Prisma; using Supabase JS client server-side
  // Allow WASM for argon2-browser in API routes (Next 15 top-level key)
  serverExternalPackages: [],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed for WASM; tighten post-MVP
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' blob: data:",
            "media-src 'self' blob:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "font-src 'self'",
            "object-src 'none'",
            "frame-src https://www.domesticshelters.org",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
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
