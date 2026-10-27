/**
 * Client loader for a topic, track, or speaker talk list.
 *
 * Production reads the precomputed catalog shard (a static asset). Dev, where
 * those shards are not generated, falls back to /api/listings.
 */
import catalogMeta from "../generated/catalog-meta.json";
import {
  largeTopicPath,
  speakerShardPath,
  topicBucketPath,
} from "./catalog-layout";
import { trackPagePath } from "./page-layout";
import type { TalkIndexEntry } from "./types";

export type ListingKind = "topic" | "track" | "speaker";

const largeTopics = new Set<string>(catalogMeta.largeTopics);

type TopicFile = { talks?: TalkIndexEntry[] };
type TopicBucket = Record<string, TalkIndexEntry[]>;
type SpeakerShard = Record<string, { talks?: TalkIndexEntry[] }>;
type TrackFile = { talks?: TalkIndexEntry[] };

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Listing ${url} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function readDirect(
  kind: ListingKind,
  key: string,
  signal?: AbortSignal,
): Promise<TalkIndexEntry[] | null> {
  if (kind === "topic") {
    if (largeTopics.has(key)) {
      const file = await readJson<TopicFile>(largeTopicPath(key), signal);
      return file?.talks?.length ? file.talks : null;
    }
    const bucket = await readJson<TopicBucket>(topicBucketPath(key), signal);
    const talks = bucket?.[key];
    return talks?.length ? talks : null;
  }

  if (kind === "speaker") {
    const shard = await readJson<SpeakerShard>(speakerShardPath(key), signal);
    const talks = shard?.[key]?.talks;
    return talks?.length ? talks : null;
  }

  let url: string;
  try {
    url = trackPagePath(key);
  } catch {
    return null;
  }
  const file = await readJson<TrackFile>(url, signal);
  return file?.talks?.length ? file.talks : null;
}

export async function fetchListingTalks(
  kind: ListingKind,
  key: string,
  signal?: AbortSignal,
): Promise<TalkIndexEntry[]> {
  // The API reads D1 when that binding is present, so an upsert shows up
  // without a new build. Shards remain the fallback.
  try {
    const response = await fetch(
      `/api/listings/${encodeURIComponent(kind)}/${encodeURIComponent(key)}`,
      { signal, cache: "no-store" },
    );
    if (response.ok) {
      const body = (await response.json()) as { talks?: TalkIndexEntry[] };
      return body.talks ?? [];
    }
    if (response.status === 404) return [];
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
  }

  const direct = await readDirect(kind, key, signal);
  return direct ?? [];
}
