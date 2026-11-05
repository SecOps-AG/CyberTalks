import { siteUrl } from "./site-url";

/** Absolute canonical URL. The homepage is the site origin with a trailing slash. */
export function canonicalUrl(path: string): string {
  if (path === "/" || path === "") return `${siteUrl()}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalized}`;
}
