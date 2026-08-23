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
  async redirects() {
    // The promoter program is NorthEDM-wide, not FestDash-specific — it moved to
    // /promote. Keep the old FestDash URLs working (QR codes, links people already
    // shared, bookmarks) so nothing that's out in the world breaks.
    return [
      { source: "/festdash/promoter-signup", destination: "/promote", permanent: true },
      { source: "/festdash/referrals", destination: "/promote/codes", permanent: true },
      { source: "/festdash/promoter-dashboard", destination: "/promote/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
