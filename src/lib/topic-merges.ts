import merges from "../../data/topic-merges.json";

/**
 * Spelling variants of one topic (kubernete, lockpicking, wifi) and the slug
 * they collapse onto. The reviewed list is data/topic-merges.json.
 */
const MERGES = merges.merges as Record<string, string>;

/** Own-property lookup, so a topic named "constructor" is not read off Object.prototype. */
function lookup(topic: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(MERGES, topic) ? MERGES[topic] : undefined;
}

export function canonicalTopicSlug(topic: string): string {
  return lookup(topic) ?? topic;
}

/** Apply the merge map to a talk's topics, keeping first-seen order and dropping repeats. */
export function mergeTopics(topics: readonly string[], alias: (topic: string) => string = (t) => t): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    const canonical = canonicalTopicSlug(alias(topic));
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/**
 * Where a request for a merged-away topic should go, or null. Only
 * /topics/<variant> (with or without a trailing slash) is rewritten; the query
 * string is kept as it came.
 */
export function topicRedirectPath(pathname: string, search: string): string | null {
  const match = /^\/topics\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const target = lookup(slug);
  if (!target) return null;
  return `/topics/${encodeURIComponent(target)}${search}`;
}
