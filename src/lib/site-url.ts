/**
 * Canonical origin for metadata, sitemap, and robots.
 *
 * NEXT_PUBLIC_SITE_URL is inlined at build time. When it is unset, use the
 * live Vercel host instead of localhost so crawlers are not sent to a dev URL.
 */
const DEFAULT_SITE_URL = "https://cyber-talks.vercel.app";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}
