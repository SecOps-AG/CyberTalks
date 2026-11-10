/**
 * Tell IndexNow about talk pages that are new or changed.
 *
 *   npx tsx scripts/indexnow.ts --since <git-sha>      talks added or changed since that commit
 *   npx tsx scripts/indexnow.ts --slugs a,b,c          these talks
 *   add --dry-run to print what would be sent without any network call
 *
 * The key is public by design: it is the contents of the key file the site
 * serves. Nothing is sent until that file answers with the key, so this is
 * safe to run before the file is deployed. Every failure is logged and the
 * process still exits 0, so a ping can never fail a deploy or a sync.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_HOST = "cybertalks.org";
export const INDEXNOW_KEY = "3c9e7e3a6337f8cb6d73cfad50b44951";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
/** IndexNow accepts at most 10,000 URLs per request. */
export const INDEXNOW_BATCH_SIZE = 10_000;

const VILLAGE_DIR = "data/villages";
/** Counters that move on every refresh and say nothing about the page. */
const VOLATILE_FIELDS = new Set([
  "viewCount",
  "likeCount",
  "commentCount",
  "viewCountFetchedAt",
]);

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Logger = (message: string) => void;

export type PingResult =
  | { status: "nothing-to-send" }
  | { status: "key-not-live"; reason: string }
  | { status: "dry-run"; urls: number; batches: number }
  | { status: "sent"; urls: number; batches: number; failedBatches: number };

export function talkUrl(slug: string): string {
  return `https://${INDEXNOW_HOST}/talks/${encodeURIComponent(slug)}`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type StoredTalkLike = { slug?: unknown } & Record<string, unknown>;

function fingerprint(talk: StoredTalkLike): string {
  const kept = Object.keys(talk)
    .filter((key) => !VOLATILE_FIELDS.has(key))
    .sort()
    .map((key) => [key, talk[key]]);
  return JSON.stringify(kept);
}

/** Slugs in `after` that are not in `before`, or whose stored fields differ. */
export function changedSlugs(before: StoredTalkLike[], after: StoredTalkLike[]): string[] {
  const previous = new Map<string, string>();
  for (const talk of before) {
    if (typeof talk.slug === "string") previous.set(talk.slug, fingerprint(talk));
  }
  const out = new Set<string>();
  for (const talk of after) {
    if (typeof talk.slug !== "string" || !talk.slug) continue;
    if (previous.get(talk.slug) !== fingerprint(talk)) out.add(talk.slug);
  }
  return [...out];
}

/** True only when the key file is live and holds exactly the key. */
export async function keyFileIsLive(
  fetchImpl: FetchLike,
): Promise<{ live: true } | { live: false; reason: string }> {
  try {
    const response = await fetchImpl(INDEXNOW_KEY_LOCATION, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { live: false, reason: `key file returned HTTP ${response.status}` };
    const body = (await response.text()).trim();
    if (body !== INDEXNOW_KEY) return { live: false, reason: "key file does not contain the key" };
    return { live: true };
  } catch (error) {
    return { live: false, reason: `key file request failed: ${(error as Error).message}` };
  }
}

export async function pingIndexNow(
  slugs: readonly string[],
  options: { fetch?: FetchLike; dryRun?: boolean; log?: Logger } = {},
): Promise<PingResult> {
  const log = options.log ?? ((message: string) => console.log(`[indexnow] ${message}`));
  const fetchImpl = options.fetch ?? fetch;

  const urls = [...new Set(slugs.filter(Boolean))].map(talkUrl);
  if (urls.length === 0) {
    log("no new or changed talks, nothing to send");
    return { status: "nothing-to-send" };
  }
  const batches = chunk(urls, INDEXNOW_BATCH_SIZE);

  if (options.dryRun) {
    log(`dry run: would send ${urls.length} URL(s) in ${batches.length} request(s) to ${INDEXNOW_ENDPOINT}`);
    return { status: "dry-run", urls: urls.length, batches: batches.length };
  }

  const key = await keyFileIsLive(fetchImpl);
  if (!key.live) {
    log(`skipping: ${key.reason} (${INDEXNOW_KEY_LOCATION})`);
    return { status: "key-not-live", reason: key.reason };
  }

  let failedBatches = 0;
  for (const [index, urlList] of batches.entries()) {
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 200 || response.status === 202) {
        log(`batch ${index + 1}/${batches.length}: ${urlList.length} URL(s) accepted (HTTP ${response.status})`);
      } else {
        failedBatches += 1;
        log(`batch ${index + 1}/${batches.length}: HTTP ${response.status}, continuing`);
      }
    } catch (error) {
      failedBatches += 1;
      log(`batch ${index + 1}/${batches.length}: ${(error as Error).message}, continuing`);
    }
  }
  return { status: "sent", urls: urls.length, batches: batches.length, failedBatches };
}

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 512,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function talksIn(json: string | null): StoredTalkLike[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { talks?: StoredTalkLike[] };
    return Array.isArray(parsed.talks) ? parsed.talks : [];
  } catch {
    return [];
  }
}

/** Talks added or changed in data/villages between `since` and the working tree's HEAD. */
export function slugsChangedSince(since: string): string[] {
  const names = git(["diff", "--name-only", "--diff-filter=AM", since, "HEAD", "--", VILLAGE_DIR]);
  if (names === null) throw new Error(`could not diff against ${since}`);
  const out = new Set<string>();
  for (const file of names.split("\n").filter((name) => name.endsWith(".json"))) {
    const before = talksIn(git(["show", `${since}:${file}`]));
    const after = talksIn(readFileSync(file, "utf8"));
    for (const slug of changedSlugs(before, after)) out.add(slug);
  }
  return [...out];
}

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  return index === -1 ? null : (argv[index + 1] ?? null);
}

export async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const slugsArg = argv.includes("--slugs") ? argValue(argv, "--slugs") : null;
  const since = argValue(argv, "--since");

  let slugs: string[];
  if (slugsArg !== null) {
    slugs = slugsArg.split(",").map((slug) => slug.trim());
  } else if (since && !/^0+$/.test(since)) {
    try {
      slugs = slugsChangedSince(since);
    } catch (error) {
      console.log(`[indexnow] skipping: ${(error as Error).message}`);
      return;
    }
  } else {
    console.log("[indexnow] no --since commit or --slugs given, nothing to send");
    return;
  }

  try {
    await pingIndexNow(slugs, { dryRun });
  } catch (error) {
    console.log(`[indexnow] failed: ${(error as Error).message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main(process.argv.slice(2));
}
