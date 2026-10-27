/**
 * Load talk JSON into D1.
 *
 * The village files stay the master copy. Remote sync writes cybertalks-d1-prod
 * from wrangler.jsonc. Pass --preview to write cybertalks-d1-preview instead.
 * Running it again with the same JSON does not duplicate rows.
 *
 *   npx tsx scripts/d1/sync.ts --full
 *   npx tsx scripts/d1/sync.ts
 *   npx tsx scripts/d1/sync.ts --remote --since <git-sha>
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJsonc } from "./jsonc";
import { getPlatformProxy } from "wrangler";
import { getSpeaker, getTalkBySlug, getTalkRows } from "../../src/lib/data";
import { ensureSchema, syncRows } from "../../src/lib/d1/apply";
import { readSpeakerRecord, readTalkBySlug, readTalkCount } from "../../src/lib/d1/read";
import { rowFromTalk, type TalkRow } from "../../src/lib/d1/rows";
import { asSql, statementToSql, type D1Like, type SqlClient, type Statement } from "../../src/lib/d1/sql";
import { relatedForAll, relatedTalks } from "../../src/lib/related";
import { slugifySpeaker } from "../../src/lib/search";
import type { Talk } from "../../src/lib/types";

const PREVIEW_CONFIG = "wrangler.d1-preview.jsonc";
const PROD_CONFIG = "wrangler.jsonc";
const PLACEHOLDER_ID = "00000000-0000-0000-0000-0000000000d1";
const PREVIEW_DATABASE = "cybertalks-d1-preview";
const PROD_DATABASE = "cybertalks-d1-prod";
const DATA_PATHS = ["data/villages", "data/events.json", "data/taxonomy.json", "data/view-counts.json"];
const FULL_REBUILD_FILES = new Set(["data/events.json", "data/taxonomy.json", "data/view-counts.json"]);

type ChangeSet = { full: boolean; files: string[] };

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} needs a value.`);
  }
  return value;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function changes(since: string | null): ChangeSet {
  if (since === "0000000000000000000000000000000000000000") {
    return { full: true, files: [] };
  }
  const args = ["diff", "--name-status"];
  if (since) args.push(since, "HEAD");
  else args.push("HEAD");
  args.push("--", ...DATA_PATHS);
  const files = new Set<string>();
  let full = false;
  for (const line of git(args).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0] ?? "";
    const paths = parts.slice(1);
    if (status.startsWith("R") || status.startsWith("C")) {
      for (const path of paths) files.add(path);
    } else if (paths[0]) {
      files.add(paths[0]);
    }
    for (const path of paths) {
      if (FULL_REBUILD_FILES.has(path)) full = true;
    }
  }
  if (!since) {
    const untracked = git(["ls-files", "--others", "--exclude-standard", "--", "data/villages"]);
    for (const path of untracked.split("\n")) {
      if (path.trim()) files.add(path.trim());
    }
  }
  return { full, files: [...files].sort() };
}

function relatedMap(talks: Talk[], indexes: number[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (indexes.length > 400) {
    const related = relatedForAll(talks);
    for (const index of indexes) {
      const id = talks[index].id;
      if (!map.has(id)) map.set(id, related[index].map((talk) => talk.id));
    }
    return map;
  }
  for (const index of indexes) {
    const talk = talks[index];
    if (map.has(talk.id)) continue;
    map.set(
      talk.id,
      relatedTalks(talk, talks).map((item) => item.id),
    );
  }
  return map;
}

function buildRows(
  items: { talk: Talk; sourceFile: string; seq: number }[],
  relatedIds: Map<string, string[]>,
): { rows: TalkRow[]; duplicateIds: number } {
  const seen = new Set<string>();
  const rows: TalkRow[] = [];
  let duplicateIds = 0;
  for (const item of items) {
    if (seen.has(item.talk.id)) {
      duplicateIds += 1;
      continue;
    }
    seen.add(item.talk.id);
    rows.push(
      rowFromTalk(item.talk, item.sourceFile, item.seq, relatedIds.get(item.talk.id) ?? []),
    );
  }
  return { rows, duplicateIds };
}

async function openLocal(): Promise<{ sql: SqlClient; close: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ TALKS_DB?: D1Like }>({
    configPath: PREVIEW_CONFIG,
    remoteBindings: false,
  });
  const db = proxy.env.TALKS_DB;
  if (!db) {
    await proxy.dispose();
    throw new Error(`${PREVIEW_CONFIG} is missing the TALKS_DB binding.`);
  }
  return { sql: asSql(db), close: () => proxy.dispose() };
}

type D1Binding = { binding?: string; database_name?: string; database_id?: string };

export function d1TargetFromConfig(text: string): { databaseId: string; databaseName: string } {
  const config = parseJsonc(text) as { name?: string; d1_databases?: D1Binding[] };
  if (config.name === "cybertalks") {
    throw new Error("Refusing to write through the legacy worker config.");
  }
  const db = (config.d1_databases ?? []).find((item) => item.binding === "TALKS_DB");
  const databaseName = db?.database_name?.trim() ?? "";
  const databaseId = db?.database_id?.trim() ?? "";
  if (!databaseName || !databaseId) {
    throw new Error("Worker config is missing the TALKS_DB database name or id.");
  }
  if (databaseId === PLACEHOLDER_ID) {
    throw new Error("TALKS_DB database_id is still the local placeholder.");
  }
  if (databaseName === "cybertalks" || databaseName.includes("cybertalks.org")) {
    throw new Error(`Refusing to write database "${databaseName}".`);
  }
  return { databaseId, databaseName };
}

function requireRemoteTarget(): { accountId: string; token: string; databaseId: string; databaseName: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const preview = process.argv.includes("--preview");
  if (!accountId || !token) {
    throw new Error("Remote sync needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  }
  const configPath = preview ? PREVIEW_CONFIG : PROD_CONFIG;
  const target = d1TargetFromConfig(readFileSync(configPath, "utf8"));
  const expected = preview ? PREVIEW_DATABASE : PROD_DATABASE;
  if (target.databaseName !== expected) {
    throw new Error(`Refusing to write "${target.databaseName}". Expected ${expected}.`);
  }
  return { accountId, token, databaseId: target.databaseId, databaseName: target.databaseName };
}

async function queryRemote(
  target: { accountId: string; token: string; databaseId: string },
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = (await response.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { results?: Record<string, unknown>[] }[];
  };
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(message || `D1 query failed (${response.status}).`);
  }
  return payload.result?.[0]?.results ?? [];
}

async function importRemoteSql(
  target: { databaseId: string; databaseName: string },
  sql: string,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "cybertalks-d1-"));
  try {
    const file = join(dir, "sync.sql");
    const configPath = join(dir, "wrangler.jsonc");
    await writeFile(file, sql);
    const preview = await readFile(PREVIEW_CONFIG, "utf8");
    const config = preview
      .replaceAll(PLACEHOLDER_ID, target.databaseId)
      .replace(/"name":\s*"cybertalks-d1-preview"/, '"name": "cybertalks-d1-sync"')
      .replace(/"service":\s*"cybertalks-d1-preview"/, '"service": "cybertalks-d1-sync"')
      .replace(/"workers_dev":\s*true/, '"workers_dev": false')
      .replace(
        /"database_name":\s*"cybertalks-d1-preview"/,
        `"database_name": ${JSON.stringify(target.databaseName)}`,
      );
    await writeFile(configPath, config);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "wrangler",
          "d1",
          "execute",
          target.databaseName,
          "--remote",
          "--yes",
          "--file",
          file,
          "--config",
          configPath,
        ],
        { stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`wrangler d1 execute exited ${code ?? "unknown"}.`));
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function openRemote(): SqlClient {
  const target = requireRemoteTarget();
  console.log(`remote database ${target.databaseName} (${target.databaseId})`);
  return {
    async exec(sql: string) {
      await importRemoteSql(target, sql);
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await queryRemote(target, sql, params)) as T[];
    },
    async batch(statements: Statement[]) {
      if (statements.length === 0) return;
      await importRemoteSql(target, statements.map((statement) => `${statementToSql(statement)};`).join("\n"));
    },
  };
}

async function checkSample(db: SqlClient, talks: Talk[]): Promise<void> {
  const seen = new Set<string>();
  const samples: Talk[] = [];
  for (const talk of talks) {
    if (seen.has(talk.slug)) continue;
    seen.add(talk.slug);
    samples.push(talk);
  }
  const picks = [samples[0], samples[Math.floor(samples.length / 2)], samples[samples.length - 1]].filter(
    (talk): talk is Talk => Boolean(talk),
  );
  for (const talk of picks) {
    const loaded = await readTalkBySlug(db, talk.slug);
    const disk = getTalkBySlug(talk.slug);
    if (!loaded || !disk || loaded.talk.id !== disk.id || loaded.talk.title !== disk.title) {
      throw new Error(`D1 talk ${talk.slug} does not match the archive.`);
    }
    const expectedRelated = relatedTalks(disk, talks).map((item) => item.id);
    const actualRelated = loaded.related.map((item) => item.id);
    if (expectedRelated.join("|") !== actualRelated.join("|")) {
      throw new Error(`Related talks mismatch for ${disk.id}.`);
    }
    const name = disk.speakers.find((speaker) => speaker.trim());
    if (!name) continue;
    const slug = slugifySpeaker(name);
    const fromDisk = getSpeaker(slug);
    const fromDb = await readSpeakerRecord(db, slug);
    if (!fromDisk || !fromDb || fromDisk.name !== fromDb.speaker.name) {
      throw new Error(`Speaker ${slug} does not match the archive.`);
    }
    if (fromDisk.talkCount !== fromDb.speaker.talkCount) {
      console.log(
        `speaker ${slug} disk ${fromDisk.talkCount} database ${fromDb.speaker.talkCount}`,
      );
    }
  }
  console.log(`check ok (${picks.length} talks)`);
}

async function main() {
  const fullFlag = process.argv.includes("--full");
  const remote = process.argv.includes("--remote");
  const check = process.argv.includes("--check");
  const since = argValue("--since");
  const filesArg = argValue("--files");
  const set = fullFlag
    ? { full: true, files: [] }
    : filesArg
      ? { full: false, files: filesArg.split(",").map((file) => file.trim()).filter(Boolean) }
      : changes(since);
  if (!set.full && set.files.length === 0) {
    console.log("nothing to sync");
    return;
  }

  console.log("loading archive...");
  const items = getTalkRows();
  const talks = items.map((item) => item.talk);
  console.log(`talks known ${talks.length}`);

  const indexes = set.full
    ? items.map((item) => item.seq)
    : items.filter((item) => set.files.includes(item.sourceFile)).map((item) => item.seq);
  console.log(set.full ? "full rebuild" : `files ${set.files.length}`);
  const relatedIds = relatedMap(talks, indexes);
  const chosen = set.full ? items : items.filter((item) => set.files.includes(item.sourceFile));
  const { rows, duplicateIds } = buildRows(chosen, relatedIds);
  if (duplicateIds > 0) console.log(`duplicate ids skipped ${duplicateIds}`);

  const opened = remote ? null : await openLocal();
  const db = opened ? opened.sql : openRemote();
  try {
    await ensureSchema(db);
    const stats = await syncRows(db, rows, set.full ? undefined : set.files);
    const left = await readTalkCount(db);
    console.log(
      `talks written ${stats.written} / unchanged ${stats.unchanged} / deleted ${stats.deleted} / in database ${left}`,
    );
    if (check) await checkSample(db, talks);
  } finally {
    if (opened) await opened.close();
  }
}

if (process.argv[1]?.endsWith("sync.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
