/**
 * A topic URL is a hub when it collects enough talks to stand as its own
 * document. One or two talks mostly repeat those talk pages, so they stay
 * out of the index. Three is the smallest set that is a real cross-talk list.
 */
export const TOPIC_INDEX_MIN = 3;

/** Filter matches written into the HTML. A broader query has to be narrowed. */
export const TOPIC_FILTER_LIMIT = 200;

export const TOPIC_FEATURED = 24;

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

export type TopicIndexView = {
  query: string;
  featured: TopicEntry[];
  listed: TopicEntry[];
  totalMatches: number;
  truncated: boolean;
  hubCount: number;
};

function topicMatches(entry: TopicEntry, query: string): boolean {
  return entry.topic.includes(query) || entry.label.toLowerCase().includes(query);
}

/**
 * Empty query: indexable hubs only (featured strip + alphabetical list).
 * A query searches every topic, including the thin long tail, and caps the
 * HTML so one letter cannot dump the whole vocabulary.
 */
export function topicIndexView(topics: readonly TopicEntry[], query: string): TopicIndexView {
  const hubs = topics.filter((entry) => topicIsIndexable(entry.count));
  if (!query) {
    const listed = hubs
      .slice()
      .sort((a, b) => a.topic.localeCompare(b.topic) || a.label.localeCompare(b.label));
    return {
      query,
      featured: hubs.slice(0, TOPIC_FEATURED),
      listed,
      totalMatches: listed.length,
      truncated: false,
      hubCount: hubs.length,
    };
  }

  const matches = topics
    .filter((entry) => topicMatches(entry, query))
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.label.localeCompare(b.label));
  return {
    query,
    featured: [],
    listed: matches.slice(0, TOPIC_FILTER_LIMIT),
    totalMatches: matches.length,
    truncated: matches.length > TOPIC_FILTER_LIMIT,
    hubCount: hubs.length,
  };
}
