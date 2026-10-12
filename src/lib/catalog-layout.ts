/**
 * Layout of the build-time catalog shards under public/catalog/.
 *
 * The generator and the Worker loader both use these constants, so a request
 * can name the one file it needs without a lookup table.
 */

export const TALK_BUCKETS = 4096;
export const SPEAKER_BUCKETS = 512;
export const TOPIC_BUCKETS = 1024;

/** Topics with at least this many talks are written to their own file. */
export const LARGE_TOPIC_MIN = 50;

/** FNV-1a, unsigned, stable across the generator and the Worker. */
export function bucketIndex(key: string, count: number): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

export function talkShardPath(slug: string): string {
  return `/catalog/talks/${bucketIndex(slug, TALK_BUCKETS)}.json`;
}

export function speakerShardPath(slug: string): string {
  return `/catalog/speakers/${bucketIndex(slug, SPEAKER_BUCKETS)}.json`;
}

export function topicBucketPath(topic: string): string {
  return `/catalog/topics/b/${bucketIndex(topic, TOPIC_BUCKETS)}.json`;
}

export function largeTopicPath(topic: string): string {
  return `/catalog/topics/large/${encodeURIComponent(topic)}.json`;
}
