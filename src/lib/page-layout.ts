/**
 * Paths for the precomputed page JSON under public/catalog/pages/.
 * Workers read these instead of opening the village archive.
 */

const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]*$/;

export function catalogSlug(slug: string): string {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Refusing to use unsafe slug in a catalog path: ${slug}`);
  }
  return slug;
}

export const homePagePath = "/catalog/pages/home.json";
export const tracksIndexPath = "/catalog/pages/tracks.json";
export const topicsIndexPath = "/catalog/pages/topics.json";
export const speakersIndexPath = "/catalog/pages/speakers.json";
export const villagesIndexPath = "/catalog/pages/defcon-villages.json";
export const coveragePagePath = "/catalog/pages/coverage.json";
export const sitemapPagePath = "/catalog/pages/sitemap.json";

export function trackPagePath(slug: string): string {
  return `/catalog/pages/tracks/${catalogSlug(slug)}.json`;
}

export function eventPagePath(slug: string): string {
  return `/catalog/pages/events/${catalogSlug(slug)}.json`;
}

export function editionPagePath(eventSlug: string, villageSlug: string): string {
  return `/catalog/pages/editions/${catalogSlug(eventSlug)}/${catalogSlug(villageSlug)}.json`;
}

export function seriesPagePath(slug: string): string {
  return `/catalog/pages/series/${catalogSlug(slug)}.json`;
}

export function hubPagePath(id: "defcon" | "black-hat" | "bsides"): string {
  return `/catalog/pages/hubs/${id}.json`;
}
