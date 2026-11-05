import { HUBS } from "./hubs";
import { TOPIC_INDEX_MIN } from "./topic-indexability";

/** Stay under the 50,000 URL sitemap limit with room for the core pages. */
export const SITEMAP_URL_LIMIT = 40_000;

export type SitemapInput = {
  events: readonly { slug: string }[];
  editions: readonly { eventSlug: string; villageSlug: string }[];
  villages: readonly { slug: string }[];
  tracks: readonly { slug: string }[];
  talkSlugs: readonly string[];
  speakers: readonly { slug: string; talkCount: number }[];
  topics: readonly { topic: string; count: number }[];
};

export function chunkList<T>(items: readonly T[], limit = SITEMAP_URL_LIMIT): T[][] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50_000) {
    throw new Error("Sitemap chunk size must be an integer from 1 to 50000.");
  }
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += limit) {
    chunks.push(items.slice(index, index + limit));
  }
  return chunks;
}

function addPath(out: string[], seen: Set<string>, path: string): void {
  if (!path.startsWith("/")) return;
  if (path.includes("?")) return;
  if (path === "/saved" || path.startsWith("/saved/")) return;
  if (seen.has(path)) return;
  seen.add(path);
  out.push(path);
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Indexable URLs only. Parameterized search, saved talks, and thin topics
 * are left out. Speaker pages are included: each slug is a real talk list.
 */
export function sitemapPaths(input: SitemapInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (path: string) => addPath(out, seen, path);

  for (const path of [
    "/",
    "/speakers",
    "/defcon/villages",
    "/tracks",
    "/topics",
    "/coverage",
    "/search",
    "/api",
  ]) {
    add(path);
  }
  for (const hub of HUBS) add(hub.href);

  const events = input.events.map((event) => event.slug).sort((a, b) => a.localeCompare(b));
  for (const slug of events) add(`/${segment(slug)}`);

  const editions = input.editions
    .map((edition) => `/${segment(edition.eventSlug)}/${segment(edition.villageSlug)}`)
    .sort((a, b) => a.localeCompare(b));
  for (const path of editions) add(path);

  const villages = input.villages
    .map((village) => village.slug)
    .sort((a, b) => a.localeCompare(b));
  for (const slug of villages) add(`/defcon/villages/${segment(slug)}`);

  const tracks = input.tracks.map((track) => track.slug).sort((a, b) => a.localeCompare(b));
  for (const slug of tracks) add(`/tracks/${segment(slug)}`);

  const talks = input.talkSlugs.slice().sort((a, b) => a.localeCompare(b));
  for (const slug of talks) add(`/talks/${segment(slug)}`);

  const speakers = input.speakers
    .filter((speaker) => speaker.slug && speaker.talkCount > 0)
    .map((speaker) => speaker.slug)
    .sort((a, b) => a.localeCompare(b));
  for (const slug of speakers) add(`/speakers/${segment(slug)}`);

  const topics = input.topics
    .filter((topic) => topic.count >= TOPIC_INDEX_MIN && topic.topic)
    .map((topic) => topic.topic)
    .sort((a, b) => a.localeCompare(b));
  for (const topic of topics) add(`/topics/${segment(topic)}`);

  return out;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function sitemapUrlset(origin: string, paths: readonly string[]): string {
  const base = origin.replace(/\/+$/, "");
  const body = paths
    .map((path) => {
      const loc = path === "/" ? `${base}/` : `${base}${path}`;
      return `  <url><loc>${escapeXml(loc)}</loc></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(origin: string, partCount: number): string {
  const base = origin.replace(/\/+$/, "");
  const body = Array.from({ length: partCount }, (_, id) => {
    const loc = `${base}/sitemaps/${id}`;
    return `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
