import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.statcounter.com https://c.statcounter.com`,
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted at build time, so no font CDN belongs here.
  "font-src 'self'",
  "img-src 'self' data: https://i.ytimg.com https://c.statcounter.com",
  // Analytics beacons.
  `connect-src 'self' https://c.statcounter.com`,
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
  // OpenNext sets this before its Next build. Keep the village archive out of
  // the Worker bundle; on-demand pages read public/catalog instead.
  // A plain `next build` leaves the variable unset and still traces data/.
  outputFileTracingExcludes:
    process.env.NEXT_PRIVATE_STANDALONE === "true"
      ? {
          "*": [
            "./data/villages/**/*",
            "./data/view-counts.json",
            "./public/catalog/**/*",
            "./public/search-index/**/*",
          ],
        }
      : undefined,
  // The browser lives at "/" now. Keep the old address working — Next carries
  // the query string over, so shared /talks?q=… links still land filtered.
  async redirects() {
    return [
      { source: "/talks", destination: "/", permanent: false },
      { source: "/villages", destination: "/defcon/villages", permanent: true },
      { source: "/villages/:village", destination: "/defcon/villages/:village", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

function searchIndexFresh(): boolean {
  const bin = path.join(process.cwd(), "public", "search-index", "index.bin");
  const meta = path.join(process.cwd(), "public", "search-index", "meta.json");
  const manifest = path.join(process.cwd(), "public", "data", "talk-index", "manifest.json");
  if (!fs.existsSync(bin) || !fs.existsSync(meta) || !fs.existsSync(manifest)) return false;
  return fs.statSync(bin).mtimeMs >= fs.statSync(manifest).mtimeMs;
}

function waitForLock(lock: string): void {
  const started = Date.now();
  while (fs.existsSync(lock)) {
    if (Date.now() - started > 180_000) {
      throw new Error("Timed out waiting for the search index build.");
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
}

/** Production builds always refresh the index. Dev refreshes it when talk shards are newer. */
function ensureSearchIndex(phase: string): void {
  const production = phase === PHASE_PRODUCTION_BUILD;
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  if (!production && !dev) return;
  if (dev && searchIndexFresh()) return;

  const dir = path.join(process.cwd(), "public", "search-index");
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, ".lock");
  try {
    if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs > 5 * 60 * 1000) {
      fs.unlinkSync(lock);
    }
  } catch {
    // Another process removed it.
  }

  try {
    const fd = fs.openSync(lock, "wx");
    fs.closeSync(fd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    waitForLock(lock);
    return;
  }

  try {
    execFileSync(
      process.execPath,
      ["--import", "tsx", path.join(process.cwd(), "scripts", "generate-search-index.ts")],
      { stdio: "inherit", cwd: process.cwd() },
    );
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      // Already cleared.
    }
  }
}

export default function nextConfigForPhase(phase: string): NextConfig {
  ensureSearchIndex(phase);
  return nextConfig;
}

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
