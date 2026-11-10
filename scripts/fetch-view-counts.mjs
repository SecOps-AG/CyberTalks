#!/usr/bin/env node
/**
 * Refresh YouTube view, like, and comment counts into data/view-counts.json.
 *
 * Counts live in their own file, keyed by youtubeId, rather than inside the
 * village files: they change often, and rewriting a village file to bump a
 * number would churn the diff of every talk. data.ts joins them onto talks
 * at load time.
 *
 * Each watch page is fetched slowly. The public page includes an exact
 * viewCount (`originalViewCount`) and an exact likeCount (the like button's
 * "along with N other people" label, or an unabbreviated Likes factoid).
 * commentCount is recorded only when that same page includes it. Nothing
 * is estimated, and a page that does not yield a view count is left unchanged.
 *
 * DEF CON 34 ids are fetched first. A rate-limit stops the run after the
 * current id's retries, once DEF CON 34 has been attempted, so a block does
 * not throw away counts already written.
 *
 *   node scripts/fetch-view-counts.mjs [--conference black-hat,rsa] [--event defcon-34]
 *                                      [--delay 1200] [--limit 50] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, parseArgs, readJson, villageFiles, writeJson } from "./lib/util.mjs";

const OUT = path.join(DATA_DIR, "view-counts.json");
const { args } = parseArgs();

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DC34_EVENT = "defcon-34";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const list = (value) =>
  typeof value === "string" ? new Set(value.split(",").map((s) => s.trim()).filter(Boolean)) : null;
const conferences = list(args.conference);
const events = list(args.event);
const delayMs = Math.max(0, Number(args.delay) || 1200);
const limit = args.limit ? Math.max(0, Number(args.limit) || 0) : Infinity;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function integerFrom(text) {
  if (typeof text !== "string" || !/^[\d,]+$/.test(text)) return null;
  const value = Number(text.replace(/,/g, ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Pull exact counters out of a YouTube watch page.
 * Returns null when the page has no exact view count (consent wall, block, or removed video).
 */
export function parseWatchStats(html) {
  if (typeof html !== "string" || html.length < 20000) return null;

  const original = html.match(/"originalViewCount":"(\d+)"/);
  let viewCount = original ? integerFrom(original[1]) : null;
  if (viewCount == null) {
    const simple = html.match(/"simpleText":"([\d,]{1,15}) views"/);
    if (simple) viewCount = integerFrom(simple[1]);
  }
  if (viewCount == null) return null;

  let likeCount = null;
  const likes = html.match(/like this video along with ([\d,]+) other (?:people|person)/i);
  if (likes) likeCount = integerFrom(likes[1]);
  if (likeCount == null) {
    const factoid = html.match(
      /"simpleText":"([\d,]+)"\},"label":\{"simpleText":"Likes"\}/,
    );
    if (factoid) likeCount = integerFrom(factoid[1]);
  }

  let commentCount = null;
  const comments =
    html.match(/"commentCount":\{"simpleText":"([\d,]+)"\}/) ??
    html.match(/"simpleText":"([\d,]+) [Cc]omments?"/);
  if (comments) commentCount = integerFrom(comments[1]);

  return { viewCount, likeCount, commentCount };
}

function entryFromStats(stats, fetchedAt) {
  const entry = { viewCount: stats.viewCount, fetchedAt };
  if (stats.likeCount != null) entry.likeCount = stats.likeCount;
  if (stats.commentCount != null) entry.commentCount = stats.commentCount;
  return entry;
}

function watchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}&hl=en&gl=US`;
}

async function fetchWatch(id) {
  let response;
  try {
    response = await fetch(watchUrl(id), {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html",
      },
      redirect: "follow",
    });
  } catch (cause) {
    const error = new Error(String(cause.message ?? cause));
    error.retryable = true;
    throw error;
  }
  if (response.status === 429 || response.status === 403) {
    const error = new Error(`HTTP ${response.status}`);
    error.retryable = true;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.retryable = response.status >= 500;
    throw error;
  }
  const html = await response.text();
  const stats = parseWatchStats(html);
  if (!stats) {
    const blocked = /unusual traffic|verify you are human|consent\.youtube/i.test(html) || html.length < 50000;
    const error = new Error(blocked ? "blocked" : "no view count");
    error.retryable = blocked;
    throw error;
  }
  return stats;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  await main();
}

async function main() {
  const wanted = [];
  const seen = new Set();
  for (const file of villageFiles()) {
    const village = readJson(file);
    if (conferences && !conferences.has(village.conference)) continue;
    if (events && !events.has(village.eventSlug)) continue;
    for (const talk of village.talks) {
      const id = talk.youtubeId;
      if (!YOUTUBE_ID.test(id ?? "") || seen.has(id)) continue;
      seen.add(id);
      wanted.push({ id, eventSlug: village.eventSlug });
    }
  }

  wanted.sort((a, b) => {
    const rank = (item) => (item.eventSlug === DC34_EVENT ? 0 : 1);
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  });

  const queue = wanted.slice(0, Number.isFinite(limit) ? limit : wanted.length);
  const dc34Total = queue.filter((item) => item.eventSlug === DC34_EVENT).length;

  const existing = fs.existsSync(OUT) ? readJson(OUT) : { counts: {} };
  const counts = { ...(existing.counts ?? {}) };

  function persist() {
    const sorted = Object.fromEntries(Object.keys(counts).sort().map((id) => [id, counts[id]]));
    writeJson(OUT, {
      notes: [
        "Generated by scripts/fetch-view-counts.mjs. Keyed by youtubeId; do not hand-edit.",
        "viewCount and likeCount are exact integers from the public YouTube watch page.",
        "commentCount is included only when that same page exposes it. Missing counts are omitted, never estimated.",
      ],
      counts: sorted,
    });
  }

  console.log(`  queue ${queue.length} (${dc34Total} DEF CON 34), delay ${delayMs}ms`);

  let updated = 0;
  let failed = 0;
  let dc34Updated = 0;
  let dc34Done = 0;
  let blocked = false;
  const fetchedAt = new Date().toISOString();

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    const isDc34 = item.eventSlug === DC34_EVENT;
    let attempt = 0;
    let stats = null;
    let backoff = Math.max(delayMs, 2000);

    while (attempt < 5) {
      try {
        stats = await fetchWatch(item.id);
        break;
      } catch (cause) {
        attempt += 1;
        const retryable = Boolean(cause.retryable);
        const message = String(cause.message ?? cause).split("\n")[0];
        if (!retryable || attempt >= 5) {
          failed += 1;
          console.warn(`  skip  ${item.id} (${message})`);
          if (retryable) blocked = true;
          break;
        }
        console.warn(`  wait  ${item.id} ${message}, retry ${attempt} in ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 5 * 60 * 1000);
      }
    }

    if (stats) {
      counts[item.id] = entryFromStats(stats, fetchedAt);
      updated += 1;
      if (isDc34) dc34Updated += 1;
      if (updated % 25 === 0) {
        if (!args["dry-run"]) persist();
        console.log(`  saved ${updated} refreshed`);
      }
    }

    if (isDc34) dc34Done += 1;
    if (dc34Done === dc34Total || (index + 1) % 10 === 0) {
      console.log(
        `  ${index + 1}/${queue.length}  dc34 ${dc34Updated}/${dc34Total}  failed ${failed}`,
      );
    }

    if (blocked && dc34Done >= dc34Total) {
      console.warn("  stopped after a block once DEF CON 34 was attempted");
      break;
    }
    if (blocked && isDc34 && dc34Done < dc34Total) {
      // Keep going through DEF CON 34, but slow down after a block.
      await sleep(backoff);
      blocked = false;
    }

    if (index + 1 < queue.length) {
      await sleep(delayMs + Math.floor(Math.random() * 400));
    }
  }

  console.log(`\n  refreshed ${updated} (${dc34Updated} DEF CON 34), failed ${failed}`);
  console.log(`  counts    ${Object.keys(counts).length} total`);

  if (args["dry-run"]) {
    console.log("  --dry-run: not written\n");
  } else {
    persist();
    console.log(`  wrote ${path.relative(process.cwd(), OUT)}\n`);
  }
}
