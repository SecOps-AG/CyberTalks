/**
 * Per-request catalog reads for talk, speaker, and topic pages.
 *
 * On Cloudflare Workers the full archive is not on disk and will not fit in
 * the isolate, so each request fetches one precomputed shard through the
 * ASSETS binding. On Node (next dev, next start, Vercel) the same functions
 * read the in-memory archive, which is how those pages have always worked.
 */
import { cache } from "react";
import {
  largeTopicPath,
  speakerShardPath,
  talkShardPath,
  topicBucketPath,
} from "./catalog-layout";
import catalogMeta from "../generated/catalog-meta.json";
import { relatedTalks } from "./related";
import type { Speaker, Talk, TalkIndexEntry } from "./types";

const largeTopics = new Set<string>(catalogMeta.largeTopics);

export type CatalogTalk = {
  talk: Talk;
  related: TalkIndexEntry[];
};

export type CatalogSpeaker = {
  speaker: Speaker;
  talks: TalkIndexEntry[];
};

type AssetsBinding = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

type TalkShard = Record<string, { talk: Talk; related: TalkIndexEntry[] }>;
type SpeakerShard = Record<string, { speaker: Speaker; talks: TalkIndexEntry[] }>;
type TopicBucket = Record<string, TalkIndexEntry[]>;
type LargeTopicFile = { talks: TalkIndexEntry[] };

const cloudflareContext = Symbol.for("__cloudflare-context__");

function assetsBinding(): AssetsBinding | null {
  const holder = (globalThis as Record<symbol, { env?: { ASSETS?: AssetsBinding } } | undefined>)[
    cloudflareContext
  ];
  const assets = holder?.env?.ASSETS;
  return assets && typeof assets.fetch === "function" ? assets : null;
}

export function onWorker(): boolean {
  const nav = globalThis.navigator as { userAgent?: string } | undefined;
  if (nav?.userAgent === "Cloudflare-Workers") return true;
  // workerd-only. `next dev` can install an ASSETS binding via
  // initOpenNextCloudflareForDev, but that process is still Node and should
  // keep reading the in-memory archive.
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair === "function";
}

async function readShard<T>(assets: AssetsBinding, pathname: string): Promise<T | null> {
  const response = await assets.fetch(new URL(pathname, "https://assets.local"));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Catalog shard ${pathname} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function loadTalkFromAssets(assets: AssetsBinding, slug: string): Promise<CatalogTalk | null> {
  const shard = await readShard<TalkShard>(assets, talkShardPath(slug));
  return shard?.[slug] ?? null;
}

async function loadSpeakerFromAssets(
  assets: AssetsBinding,
  slug: string,
): Promise<CatalogSpeaker | null> {
  const shard = await readShard<SpeakerShard>(assets, speakerShardPath(slug));
  return shard?.[slug] ?? null;
}

async function loadTopicFromAssets(
  assets: AssetsBinding,
  topic: string,
): Promise<TalkIndexEntry[] | null> {
  if (largeTopics.has(topic)) {
    const file = await readShard<LargeTopicFile>(assets, largeTopicPath(topic));
    return file?.talks?.length ? file.talks : null;
  }
  const bucket = await readShard<TopicBucket>(assets, topicBucketPath(topic));
  const talks = bucket?.[topic];
  return talks?.length ? talks : null;
}

async function loadTalkFromDisk(slug: string): Promise<CatalogTalk | null> {
  const [{ getTalkBySlug, getTalkIndex, getTalks }] = await Promise.all([import("./data")]);
  const talk = getTalkBySlug(slug);
  if (!talk) return null;
  return { talk, related: getTalkIndex(relatedTalks(talk, getTalks())) };
}

async function loadSpeakerFromDisk(slug: string): Promise<CatalogSpeaker | null> {
  const { getSpeaker, getTalkIndex, getTalksForSpeaker } = await import("./data");
  const speaker = getSpeaker(slug);
  if (!speaker) return null;
  return { speaker, talks: getTalkIndex(getTalksForSpeaker(speaker.slug)) };
}

async function loadTopicFromDisk(topic: string): Promise<TalkIndexEntry[] | null> {
  const { getTalkIndex, getTalksForTopic } = await import("./data");
  const talks = getTalkIndex(getTalksForTopic(topic));
  return talks.length > 0 ? talks : null;
}

export async function readPublicJson<T>(pathname: string): Promise<T | null> {
  const assets = requireAssets();
  if (assets) return readShard<T>(assets, pathname);
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const text = await readFile(join(process.cwd(), "public", pathname), "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function requireAssets(): AssetsBinding | null {
  if (!onWorker()) return null;
  const assets = assetsBinding();
  if (!assets) {
    throw new Error("Catalog shards need the ASSETS binding.");
  }
  return assets;
}

export const loadTalk = cache(async (slug: string): Promise<CatalogTalk | null> => {
  const assets = requireAssets();
  return assets ? loadTalkFromAssets(assets, slug) : loadTalkFromDisk(slug);
});

export const loadSpeaker = cache(async (slug: string): Promise<CatalogSpeaker | null> => {
  const assets = requireAssets();
  return assets ? loadSpeakerFromAssets(assets, slug) : loadSpeakerFromDisk(slug);
});

export const loadTopic = cache(async (topic: string): Promise<TalkIndexEntry[] | null> => {
  const assets = requireAssets();
  return assets ? loadTopicFromAssets(assets, topic) : loadTopicFromDisk(topic);
});
