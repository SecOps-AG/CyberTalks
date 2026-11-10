import { siteUrl } from "./site-url";

/**
 * Where a request for the www host should go, or null when it needs no redirect.
 *
 * The Worker answers on both cybertalks.org and www.cybertalks.org. Search
 * engines should only ever see the apex, so www sends a permanent redirect to
 * the same path and query on the canonical origin.
 */
export function wwwRedirectTarget(
  hostHeader: string | null | undefined,
  pathname: string,
  search: string,
): string | null {
  if (!hostHeader) return null;
  const canonical = new URL(siteUrl());
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (host !== `www.${canonical.hostname}`) return null;
  return `${canonical.origin}${pathname}${search}`;
}
