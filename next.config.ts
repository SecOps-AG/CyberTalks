import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Every third-party origin the pages actually reach for. Anything not listed
 * here is a bug or an unwanted addition, which is the point of the policy.
 */
const csp = [
  "default-src 'self'",
  // Inline script is unavoidable: Next inlines hydration data on every page and
  // the counter's config is an inline snippet, and a static site has no request
  // to mint a nonce from. `unsafe-eval` is the dev-only refresh runtime.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.statcounter.com https://c.statcounter.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted at build time, so no font CDN belongs here.
  "font-src 'self'",
  "img-src 'self' data: https://i.ytimg.com https://c.statcounter.com",
  // api.github.com is the header's star count; the rest are analytics beacons.
  "connect-src 'self' https://api.github.com https://c.statcounter.com https://va.vercel-scripts.com",
  "frame-src https://www.youtube.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // The archive needs none of these. Anything the YouTube player relies on
  // (autoplay, fullscreen, encrypted-media, picture-in-picture) is left alone.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser lives at "/" now. Keep the old address working — Next carries
  // the query string over, so shared /talks?q=… links still land filtered.
  async redirects() {
    return [{ source: "/talks", destination: "/", permanent: false }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
