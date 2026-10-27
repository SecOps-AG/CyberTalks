/**
 * Canonical origin for metadata, sitemap, and robots.
 *
 * NEXT_PUBLIC_SITE_URL is inlined at build time when it is set, and Workers
 * also receive it from the wrangler vars. When it is unset, use the public
 * site so crawlers are never sent to localhost or a retired host.
 */
const DEFAULT_SITE_URL = "https://cybertalks.org";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_SITE_URL;
}
