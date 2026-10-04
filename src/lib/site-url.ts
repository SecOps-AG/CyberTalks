/**
 * Canonical origin for metadata, sitemap, and robots.
 *
 * NEXT_PUBLIC_SITE_URL is inlined at build time. When it is unset, use the
 * live Vercel host instead of localhost so crawlers are not sent to a dev URL.
 */
const DEFAULT_SITE_URL = "https://cyber-talks.vercel.app";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // Local dev keeps localhost. Production builds (Vercel or Workers) that
  // forget the env var must not advertise localhost to crawlers.
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return DEFAULT_SITE_URL;
}
