import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// A build-stable version string (the git SHA on Vercel; a build timestamp
// otherwise). Evaluated once at build time and baked into the client bundle, so
// it changes per deploy but never per request. The service worker uses it to
// name its cache and to force a fresh install on every release.
const SW_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || `build-${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SW_VERSION: SW_VERSION,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Never let the browser serve the service worker script from its HTTP
        // cache — otherwise a deploy can be pinned to the old worker.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
