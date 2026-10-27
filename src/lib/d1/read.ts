import { speakerFromTalks } from "./speaker";
import type { SqlClient } from "./sql";
import type { Speaker, Talk, TalkIndexEntry } from "../types";

/** Talks per homepage index file. Keeps one response under a few megabytes. */
export const TALK_INDEX_PART = 2500;

export type TalkIndexChunkMeta = {
  file: string;
  conferences: string[];
  talks: number;
  bytes: number;
  priority: number;
};

export type TalkIndexManifest = {
  version: 1;
  years: number[];
  chunks: Record<string, TalkIndexChunkMeta[]>;
};

type IndexRow = { index_json: string };
type BodyRow = { body: string; index_json: string };

function parseIndex(row: IndexRow): TalkIndexEntry {
  return JSON.parse(row.index_json) as TalkIndexEntry;
}

async function indexWhere(
  db: SqlClient,
  whereSql: string,
  params: unknown[],
): Promise<TalkIndexEntry[]> {
  const talks: TalkIndexEntry[] = [];
  let offset = 0;
  for (;;) {
    const rows = await db.all<IndexRow>(
      `SELECT index_json FROM talks WHERE ${whereSql} ORDER BY seq LIMIT ? OFFSET ?`,
      [...params, 2000, offset],
    );
    for (const row of rows) talks.push(parseIndex(row));
    if (rows.length < 2000) break;
    offset += rows.length;
  }
  return talks;
}

export async function readTalkBySlug(
  db: SqlClient,
  slug: string,
): Promise<{ talk: Talk; related: TalkIndexEntry[] } | null> {
  const rows = await db.all<{ body: string; related_ids: string }>(
    "SELECT body, related_ids FROM talks WHERE slug = ? ORDER BY seq LIMIT 1",
    [slug],
  );
  const row = rows[0];
  if (!row) return null;
  const talk = JSON.parse(row.body) as Talk;
  const relatedIds = JSON.parse(row.related_ids) as string[];
  if (relatedIds.length === 0) return { talk, related: [] };

  const placeholders = relatedIds.map(() => "?").join(", ");
  const relatedRows = await db.all<{ id: string; index_json: string }>(
    `SELECT id, index_json FROM talks WHERE id IN (${placeholders})`,
    relatedIds,
  );
  const byId = new Map(relatedRows.map((item) => [item.id, parseIndex(item)]));
  const related = relatedIds.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  return { talk, related };
}

export async function readTopicTalks(
  db: SqlClient,
  topic: string,
): Promise<TalkIndexEntry[]> {
  const talks: TalkIndexEntry[] = [];
  let offset = 0;
  for (;;) {
    const rows = await db.all<IndexRow>(
      `SELECT t.index_json AS index_json
       FROM talks t
       JOIN talk_topics tt ON tt.talk_id = t.id
       WHERE tt.topic = ?
       ORDER BY t.seq
       LIMIT ? OFFSET ?`,
      [topic, 2000, offset],
    );
    for (const row of rows) talks.push(parseIndex(row));
    if (rows.length < 2000) break;
    offset += rows.length;
  }
  return talks;
}

export async function readTrackTalks(db: SqlClient, track: string): Promise<TalkIndexEntry[]> {
  return indexWhere(db, "track = ?", [track]);
}

export async function readSpeakerRecord(
  db: SqlClient,
  slug: string,
): Promise<{ speaker: Speaker; talks: TalkIndexEntry[] } | null> {
  const bodies: Talk[] = [];
  const talks: TalkIndexEntry[] = [];
  let offset = 0;
  for (;;) {
    const rows = await db.all<BodyRow>(
      `SELECT t.body AS body, t.index_json AS index_json
       FROM talks t
       JOIN talk_speakers s ON s.talk_id = t.id
       WHERE s.speaker_slug = ?
       ORDER BY t.seq
       LIMIT ? OFFSET ?`,
      [slug, 500, offset],
    );
    for (const row of rows) {
      bodies.push(JSON.parse(row.body) as Talk);
      talks.push(parseIndex(row));
    }
    if (rows.length < 500) break;
    offset += rows.length;
  }
  const speaker = speakerFromTalks(slug, bodies);
  if (!speaker) return null;
  return { speaker, talks };
}

export function chunkMetas(
  year: number,
  count: number,
  conferences: string[],
): TalkIndexChunkMeta[] {
  const confs = [...new Set(conferences)].sort();
  const parts = Math.max(1, Math.ceil(count / TALK_INDEX_PART));
  return Array.from({ length: parts }, (_, index) => {
    const start = index * TALK_INDEX_PART;
    const talks = Math.min(TALK_INDEX_PART, count - start);
    return {
      file: parts === 1 ? `talks-${year}.json` : `talks-${year}-${index}.json`,
      conferences: confs,
      talks,
      bytes: 0,
      priority: index,
    };
  });
}

export function parseTalkIndexFile(file: string): { year: number; offset: number } | null {
  const single = /^talks-(\d{4})\.json$/.exec(file);
  if (single) return { year: Number(single[1]), offset: 0 };
  const part = /^talks-(\d{4})-(\d+)\.json$/.exec(file);
  if (!part) return null;
  return { year: Number(part[1]), offset: Number(part[2]) * TALK_INDEX_PART };
}

export async function readManifest(db: SqlClient): Promise<TalkIndexManifest> {
  const rows = await db.all<{ year: number; conference: string; n: number }>(
    "SELECT year, conference, COUNT(*) AS n FROM talks GROUP BY year, conference",
  );
  const byYear = new Map<number, { count: number; conferences: string[] }>();
  for (const row of rows) {
    const year = Number(row.year);
    const entry = byYear.get(year) ?? { count: 0, conferences: [] };
    entry.count += Number(row.n);
    entry.conferences.push(row.conference);
    byYear.set(year, entry);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const chunks: TalkIndexManifest["chunks"] = {};
  for (const year of years) {
    const entry = byYear.get(year);
    if (!entry) continue;
    chunks[String(year)] = chunkMetas(year, entry.count, entry.conferences);
  }
  return { version: 1, years, chunks };
}

export async function readTalkIndexFile(
  db: SqlClient,
  file: string,
): Promise<TalkIndexEntry[] | null> {
  const parsed = parseTalkIndexFile(file);
  if (!parsed) return null;
  const rows = await db.all<IndexRow>(
    "SELECT index_json FROM talks WHERE year = ? ORDER BY seq LIMIT ? OFFSET ?",
    [parsed.year, TALK_INDEX_PART, parsed.offset],
  );
  return rows.map(parseIndex);
}

export async function readYearSummaries(
  db: SqlClient,
  year: number,
): Promise<{ id: string; summary: string }[]> {
  const summaries: { id: string; summary: string }[] = [];
  let offset = 0;
  for (;;) {
    const rows = await db.all<{ id: string; summary_text: string }>(
      `SELECT id, summary_text FROM talks
       WHERE year = ? AND summary_text IS NOT NULL
       ORDER BY seq
       LIMIT ? OFFSET ?`,
      [year, 2000, offset],
    );
    for (const row of rows) summaries.push({ id: row.id, summary: row.summary_text });
    if (rows.length < 2000) break;
    offset += rows.length;
  }
  return summaries;
}

export async function readTalkCount(db: SqlClient): Promise<number> {
  const rows = await db.all<{ n: number }>("SELECT COUNT(*) AS n FROM talks");
  return Number(rows[0]?.n ?? 0);
}
