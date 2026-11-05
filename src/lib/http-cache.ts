/**
 * Talk-index and summary JSON. Public so the browser and the CDN can reuse a
 * year shard. Five minutes is long enough to absorb a homepage burst and short
 * enough that a D1 sync is not stuck for an hour.
 */
export const CATALOG_CACHE_CONTROL = "public, max-age=120, stale-while-revalidate=600";
export const CATALOG_CDN_CACHE_CONTROL = "public, max-age=300";

/**
 * /search HTML. Cache-Control is public and the CDN key is the full URL, so
 * /search and /search?q=ransomware are different entries. A minute covers the
 * cold worker render; the next miss after a D1 sync is fresh.
 */
export const SEARCH_PAGE_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
export const SEARCH_PAGE_CDN_CACHE_CONTROL = "public, max-age=60";

/** /topics is rendered per filter query. Same full-URL cache key, slightly longer. */
export const TOPICS_PAGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
export const TOPICS_PAGE_CDN_CACHE_CONTROL = "public, max-age=300";

export const SITEMAP_CACHE_CONTROL = "public, max-age=3600";
export const SITEMAP_CDN_CACHE_CONTROL = "public, max-age=3600";

export function catalogCacheHeaders(status = 200): Record<string, string> {
  if (status !== 200) return { "Cache-Control": "no-store" };
  return {
    "Cache-Control": CATALOG_CACHE_CONTROL,
    "CDN-Cache-Control": CATALOG_CDN_CACHE_CONTROL,
  };
}

export function searchPageCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": SEARCH_PAGE_CACHE_CONTROL,
    "CDN-Cache-Control": SEARCH_PAGE_CDN_CACHE_CONTROL,
  };
}

export function topicsPageCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": TOPICS_PAGE_CACHE_CONTROL,
    "CDN-Cache-Control": TOPICS_PAGE_CDN_CACHE_CONTROL,
  };
}

export function sitemapCacheHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": SITEMAP_CACHE_CONTROL,
    "CDN-Cache-Control": SITEMAP_CDN_CACHE_CONTROL,
  };
}
