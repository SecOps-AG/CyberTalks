/**
 * A topic URL is a hub when it collects enough talks to stand as its own
 * document. One or two talks mostly repeat those talk pages, so they stay
 * out of the index. Three is the smallest set that is a real cross-talk list.
 */
export const TOPIC_INDEX_MIN = 3;

/** Filter matches written into the HTML. A broader query has to be narrowed. */
export const TOPIC_FILTER_LIMIT = 200;

export const TOPIC_FEATURED = 24;

/** Hubs per page on /topics. The full list is 10k links, so it is paged. */
export const TOPIC_PAGE_SIZE = 120;

export type TopicEntry = { topic: string; label: string; count: number };

export function topicIsIndexable(count: number): boolean {
  return count >= TOPIC_INDEX_MIN;
}

export function topicRobots(count: number): { index: boolean; follow: true } {
  return { index: topicIsIndexable(count), follow: true };
}

export function topicQueryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim().toLowerCase().slice(0, 80);
}

/** `?page=` as a positive integer; anything else is page 1. */
export function topicPageValue(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const page = /^\d{1,6}$/.test(raw.trim()) ? Number.parseInt(raw, 10) : 1;
  return page >= 1 ? page : 1;
}

export type TopicIndexView = {
  query: string;
  featured: TopicEntry[];
  listed: TopicEntry[];
  totalMatches: number;
  truncated: boolean;
  hubCount: number;
  /** Current page of the hub list. Always 1 while a query is active. */
  page: number;
  totalPages: number;
  /** 1-based position of the first and last listed hub within all matches. */
  from: number;
  to: number;
};

const collator = new Intl.Collator();

function byTopic(a: TopicEntry, b: TopicEntry): number {
  return collator.compare(a.topic, b.topic) || collator.compare(a.label, b.label);
}

/** The alphabetical hub list, built once per topic array. */
const hubCache = new WeakMap<readonly TopicEntry[], TopicEntry[]>();

function alphabeticalHubs(topics: readonly TopicEntry[]): TopicEntry[] {
  let hubs = hubCache.get(topics);
  if (!hubs) {
    hubs = topics.filter((entry) => topicIsIndexable(entry.count)).sort(byTopic);
    hubCache.set(topics, hubs);
  }
  return hubs;
}

function topicMatches(entry: TopicEntry, query: string): boolean {
  return entry.topic.includes(query) || entry.label.toLowerCase().includes(query);
}

/** `topics` arrives most-used first, so its indexable head is the featured set. */
function featuredHubs(topics: readonly TopicEntry[]): TopicEntry[] {
  const out: TopicEntry[] = [];
  for (const entry of topics) {
    if (!topicIsIndexable(entry.count)) continue;
    out.push(entry);
    if (out.length === TOPIC_FEATURED) break;
  }
  return out;
}

/**
 * Empty query: indexable hubs only (featured strip on page 1, then the
 * alphabetical list one page at a time). A query searches every topic,
 * including the thin long tail, and caps the HTML so one letter cannot dump
 * the whole vocabulary. A page past the end is clamped to the last page.
 */
export function topicIndexView(
  topics: readonly TopicEntry[],
  query: string,
  page = 1,
): TopicIndexView {
  if (!query) {
    const hubs = alphabeticalHubs(topics);
    const totalPages = Math.max(1, Math.ceil(hubs.length / TOPIC_PAGE_SIZE));
    const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
    const start = (current - 1) * TOPIC_PAGE_SIZE;
    const listed = hubs.slice(start, start + TOPIC_PAGE_SIZE);
    return {
      query,
      featured: current === 1 ? featuredHubs(topics) : [],
      listed,
      totalMatches: hubs.length,
      truncated: false,
      hubCount: hubs.length,
      page: current,
      totalPages,
      from: listed.length === 0 ? 0 : start + 1,
      to: start + listed.length,
    };
  }

  const matches = topics.filter((entry) => topicMatches(entry, query)).sort(byTopic);
  const listed = matches.slice(0, TOPIC_FILTER_LIMIT);
  return {
    query,
    featured: [],
    listed,
    totalMatches: matches.length,
    truncated: matches.length > TOPIC_FILTER_LIMIT,
    hubCount: topics.reduce((n, entry) => n + (topicIsIndexable(entry.count) ? 1 : 0), 0),
    page: 1,
    totalPages: 1,
    from: listed.length === 0 ? 0 : 1,
    to: listed.length,
  };
}
