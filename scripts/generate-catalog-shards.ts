/**
 * Split the talk archive into small JSON shards the Worker can fetch one at a time.
 *
 *   public/catalog/talks/<bucket>.json
 *   public/catalog/speakers/<bucket>.json
 *   public/catalog/topics/b/<bucket>.json
 *   public/catalog/topics/large/<topic>.json
 *   src/generated/stats.json
 *   src/generated/catalog-meta.json
 *
 * Talk shards include the three related talks, computed with the same ranking
 * as src/lib/related.ts. A sample is checked against a full scan before write.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LARGE_TOPIC_MIN,
  SPEAKER_BUCKETS,
  TALK_BUCKETS,
  TOPIC_BUCKETS,
  bucketIndex,
} from "../src/lib/catalog-layout";
import { getSpeakers, getStats, getTalks } from "../src/lib/data";
import { relatedForAll, relatedTalks } from "../src/lib/related";
import { buildIndexEntry, slugifySpeaker } from "../src/lib/search";
import type { Speaker, Talk, TalkIndexEntry } from "../src/lib/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = path.join(root, "public", "catalog");
const generatedDir = path.join(root, "src", "generated");

const SAFE_TOPIC = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type TalkRecord = { talk: Talk; related: TalkIndexEntry[] };
type SpeakerRecord = { speaker: Speaker; talks: TalkIndexEntry[] };

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function writePretty(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertRelated(talks: Talk[], computed: Talk[][]) {
  const indexes = new Set<number>([0, 1, 2, talks.length - 1, talks.length - 2]);
  const step = Math.max(1, Math.floor(talks.length / 40));
  for (let index = 0; index < talks.length; index += step) indexes.add(index);

  let largestTopic = "";
  let largestTopicCount = 0;
  const topicCounts = new Map<string, number>();
  const trackCounts = new Map<string, number>();
  for (const talk of talks) {
    trackCounts.set(talk.track, (trackCounts.get(talk.track) ?? 0) + 1);
    for (const topic of talk.topics) {
      const count = (topicCounts.get(topic) ?? 0) + 1;
      topicCounts.set(topic, count);
      if (count > largestTopicCount) {
        largestTopic = topic;
        largestTopicCount = count;
      }
    }
  }
  const largestTrack = [...trackCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (let index = 0; index < talks.length; index++) {
    if (talks[index].topics.includes(largestTopic) || talks[index].track === largestTrack) {
      indexes.add(index);
      if (indexes.size > 80) break;
    }
  }

  const mismatches: string[] = [];
  for (const index of indexes) {
    const expected = relatedTalks(talks[index], talks).map((talk) => talk.id);
    const actual = computed[index].map((talk) => talk.id);
    if (expected.join("|") !== actual.join("|")) {
      mismatches.push(
        `${talks[index].slug}: expected ${expected.join(", ") || "(none)"} but got ${actual.join(", ") || "(none)"}`,
      );
      if (mismatches.length >= 8) break;
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`Related-talk mismatch:\n${mismatches.join("\n")}`);
  }
  console.log(`Related talks matched a full scan on ${indexes.size} samples.`);
}

function main() {
  const started = Date.now();
  console.log("Loading archive...");
  const talks = getTalks();
  const entries = talks.map(buildIndexEntry);
  console.log(`Loaded ${talks.length} talks in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  console.log("Computing related talks...");
  const relatedStarted = Date.now();
  const related = relatedForAll(talks);
  console.log(`Related talks computed in ${((Date.now() - relatedStarted) / 1000).toFixed(1)}s`);
  assertRelated(talks, related);

  fs.rmSync(catalogDir, { recursive: true, force: true });

  const talkBuckets: TalkRecord[][] = Array.from({ length: TALK_BUCKETS }, () => []);
  const talkKeys: string[][] = Array.from({ length: TALK_BUCKETS }, () => []);
  let duplicateSlugs = 0;
  const seenSlugs = new Set<string>();
  for (let index = 0; index < talks.length; index++) {
    const talk = talks[index];
    if (seenSlugs.has(talk.slug)) {
      duplicateSlugs += 1;
      continue;
    }
    seenSlugs.add(talk.slug);
    const bucket = bucketIndex(talk.slug, TALK_BUCKETS);
    talkKeys[bucket].push(talk.slug);
    talkBuckets[bucket].push({
      talk,
      related: related[index].map(buildIndexEntry),
    });
  }

  let talkBytes = 0;
  let largestTalkBucket = 0;
  for (let bucket = 0; bucket < TALK_BUCKETS; bucket++) {
    const body: Record<string, TalkRecord> = {};
    const keys = talkKeys[bucket];
    const records = talkBuckets[bucket];
    for (let i = 0; i < keys.length; i++) body[keys[i]] = records[i];
    const json = JSON.stringify(body);
    talkBytes += json.length;
    if (json.length > largestTalkBucket) largestTalkBucket = json.length;
    const file = path.join(catalogDir, "talks", `${bucket}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, json);
  }

  const speakers = getSpeakers();
  const speakerBySlug = new Map(speakers.map((speaker) => [speaker.slug, speaker]));
  const talksBySpeaker = new Map<string, TalkIndexEntry[]>();
  for (let index = 0; index < talks.length; index++) {
    const seenOnTalk = new Set<string>();
    for (const name of talks[index].speakers) {
      const slug = slugifySpeaker(name);
      // getTalksForSpeaker returns each talk once, even if the name repeats.
      if (!slug || !speakerBySlug.has(slug) || seenOnTalk.has(slug)) continue;
      seenOnTalk.add(slug);
      const list = talksBySpeaker.get(slug);
      if (list) list.push(entries[index]);
      else talksBySpeaker.set(slug, [entries[index]]);
    }
  }

  const speakerBuckets: Array<Record<string, SpeakerRecord>> = Array.from(
    { length: SPEAKER_BUCKETS },
    () => ({}),
  );
  for (const speaker of speakers) {
    const bucket = bucketIndex(speaker.slug, SPEAKER_BUCKETS);
    speakerBuckets[bucket][speaker.slug] = {
      speaker,
      talks: talksBySpeaker.get(speaker.slug) ?? [],
    };
  }
  let speakerBytes = 0;
  let largestSpeakerBucket = 0;
  for (let bucket = 0; bucket < SPEAKER_BUCKETS; bucket++) {
    const json = JSON.stringify(speakerBuckets[bucket]);
    speakerBytes += json.length;
    if (json.length > largestSpeakerBucket) largestSpeakerBucket = json.length;
    writeJson(path.join(catalogDir, "speakers", `${bucket}.json`), speakerBuckets[bucket]);
  }

  const talksByTopic = new Map<string, TalkIndexEntry[]>();
  for (let index = 0; index < talks.length; index++) {
    for (const topic of talks[index].topics) {
      const list = talksByTopic.get(topic);
      if (list) list.push(entries[index]);
      else talksByTopic.set(topic, [entries[index]]);
    }
  }

  const largeTopics: string[] = [];
  const topicBuckets: Array<Record<string, TalkIndexEntry[]>> = Array.from(
    { length: TOPIC_BUCKETS },
    () => ({}),
  );
  let topicBytes = 0;
  let largestTopicFile = 0;
  const unsafeLarge: string[] = [];

  for (const [topic, topicTalks] of talksByTopic) {
    const largeEnough = topicTalks.length >= LARGE_TOPIC_MIN;
    const safeName = topic.length <= 120 && SAFE_TOPIC.test(topic);
    if (largeEnough && !safeName) unsafeLarge.push(topic);
    if (largeEnough && safeName) {
      largeTopics.push(topic);
      const json = JSON.stringify({ talks: topicTalks });
      topicBytes += json.length;
      if (json.length > largestTopicFile) largestTopicFile = json.length;
      writeJson(path.join(catalogDir, "topics", "large", `${topic}.json`), { talks: topicTalks });
      continue;
    }
    topicBuckets[bucketIndex(topic, TOPIC_BUCKETS)][topic] = topicTalks;
  }
  largeTopics.sort();

  for (let bucket = 0; bucket < TOPIC_BUCKETS; bucket++) {
    const json = JSON.stringify(topicBuckets[bucket]);
    topicBytes += json.length;
    if (json.length > largestTopicFile) largestTopicFile = json.length;
    writeJson(path.join(catalogDir, "topics", "b", `${bucket}.json`), topicBuckets[bucket]);
  }

  const stats = getStats();
  writePretty(path.join(generatedDir, "stats.json"), stats);
  writePretty(path.join(generatedDir, "catalog-meta.json"), { largeTopics });

  const fileCount =
    TALK_BUCKETS + SPEAKER_BUCKETS + TOPIC_BUCKETS + largeTopics.length;
  const totalBytes = talkBytes + speakerBytes + topicBytes;
  console.log(
    [
      `Wrote ${fileCount} catalog files (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`,
      `Talks ${TALK_BUCKETS} buckets, largest ${(largestTalkBucket / 1024).toFixed(0)} KB.`,
      `Speakers ${SPEAKER_BUCKETS} buckets, largest ${(largestSpeakerBucket / 1024).toFixed(0)} KB.`,
      `Topics ${largeTopics.length} large files + ${TOPIC_BUCKETS} buckets, largest ${(largestTopicFile / 1024).toFixed(0)} KB.`,
      `Duplicate talk slugs skipped: ${duplicateSlugs}.`,
      unsafeLarge.length ? `Large topics kept in buckets (unsafe names): ${unsafeLarge.join(", ")}` : "",
      `Stats: ${stats.talks} talks, ${stats.speakers} speakers, ${stats.topics} topics.`,
      `Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

main();
