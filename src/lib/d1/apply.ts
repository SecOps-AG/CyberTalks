import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TalkRow } from "./rows";
import type { SqlClient, Statement } from "./sql";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/d1/0001_talks.sql");

export type SyncStats = {
  written: number;
  unchanged: number;
  deleted: number;
};

const UPSERT = `
INSERT INTO talks (
  id, slug, seq, youtube_id, source_file, edition_id, event_slug, village_slug,
  conference, year, track, kind, has_summary, view_count, summary_text, body,
  index_json, related_ids, content_hash
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  seq = excluded.seq,
  youtube_id = excluded.youtube_id,
  source_file = excluded.source_file,
  edition_id = excluded.edition_id,
  event_slug = excluded.event_slug,
  village_slug = excluded.village_slug,
  conference = excluded.conference,
  year = excluded.year,
  track = excluded.track,
  kind = excluded.kind,
  has_summary = excluded.has_summary,
  view_count = excluded.view_count,
  summary_text = excluded.summary_text,
  body = excluded.body,
  index_json = excluded.index_json,
  related_ids = excluded.related_ids,
  content_hash = excluded.content_hash
WHERE talks.content_hash != excluded.content_hash
`.trim();

export function loadSchemaSql(): string {
  return readFileSync(schemaPath, "utf8");
}

export async function ensureSchema(db: SqlClient): Promise<void> {
  await db.exec(loadSchemaSql());
}

function talkParams(row: TalkRow): unknown[] {
  return [
    row.id,
    row.slug,
    row.seq,
    row.youtubeId,
    row.sourceFile,
    row.editionId,
    row.eventSlug,
    row.villageSlug,
    row.conference,
    row.year,
    row.track,
    row.kind,
    row.hasSummary,
    row.viewCount,
    row.summaryText,
    row.body,
    row.indexJson,
    row.relatedIds,
    row.contentHash,
  ];
}

function junctionStatements(row: TalkRow, replace: boolean): Statement[] {
  const statements: Statement[] = [];
  if (replace) {
    statements.push(
      { sql: "DELETE FROM talk_topics WHERE talk_id = ?", params: [row.id] },
      { sql: "DELETE FROM talk_speakers WHERE talk_id = ?", params: [row.id] },
    );
  }
  for (const topic of row.topics) {
    statements.push({
      sql: "INSERT OR IGNORE INTO talk_topics (talk_id, topic) VALUES (?, ?)",
      params: [row.id, topic],
    });
  }
  for (const speaker of row.speakers) {
    statements.push({
      sql: "INSERT OR IGNORE INTO talk_speakers (talk_id, speaker_slug, speaker_name) VALUES (?, ?, ?)",
      params: [row.id, speaker.slug, speaker.name],
    });
  }
  return statements;
}

type Existing = { hash: string; sourceFile: string };

async function loadExisting(db: SqlClient): Promise<Map<string, Existing>> {
  const existing = new Map<string, Existing>();
  let after = "";
  for (;;) {
    const rows = await db.all<{ id: string; content_hash: string; source_file: string }>(
      "SELECT id, content_hash, source_file FROM talks WHERE id > ? ORDER BY id LIMIT 2000",
      [after],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      existing.set(row.id, { hash: row.content_hash, sourceFile: row.source_file });
    }
    after = rows[rows.length - 1].id;
    if (rows.length < 2000) break;
  }
  return existing;
}

function deleteStatements(id: string): Statement[] {
  return [
    { sql: "DELETE FROM talk_topics WHERE talk_id = ?", params: [id] },
    { sql: "DELETE FROM talk_speakers WHERE talk_id = ?", params: [id] },
    { sql: "DELETE FROM talks WHERE id = ?", params: [id] },
  ];
}

/**
 * Upsert these rows. When `sourceFiles` is set, talks in those files that are
 * not in `rows` are removed. Otherwise talks missing from `rows` are removed
 * (a full rebuild). The same input twice does not write duplicate rows.
 */
export async function syncRows(
  db: SqlClient,
  rows: TalkRow[],
  sourceFiles?: string[],
): Promise<SyncStats> {
  const stats: SyncStats = { written: 0, unchanged: 0, deleted: 0 };
  const existing = await loadExisting(db);
  const incoming = new Set(rows.map((row) => row.id));
  const statements: Statement[] = [];
  const files = sourceFiles ? new Set(sourceFiles) : null;

  for (const [id, row] of existing) {
    if (incoming.has(id)) continue;
    if (files && !files.has(row.sourceFile)) continue;
    statements.push(...deleteStatements(id));
    stats.deleted += 1;
  }

  for (const row of rows) {
    const previous = existing.get(row.id);
    if (previous?.hash === row.contentHash) {
      stats.unchanged += 1;
      continue;
    }
    statements.push({ sql: UPSERT, params: talkParams(row) });
    statements.push(...junctionStatements(row, previous != null));
    stats.written += 1;
  }

  if (statements.length > 0) await db.batch(statements);

  const count = await db.all<{ n: number }>("SELECT COUNT(*) AS n FROM talks");
  const total = Number(count[0]?.n ?? rows.length);
  const now = new Date().toISOString();
  await db.batch([
    {
      sql: "INSERT INTO meta (key, value) VALUES ('talk_count', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params: [String(total)],
    },
    {
      sql: "INSERT INTO meta (key, value) VALUES ('synced_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params: [now],
    },
  ]);

  return stats;
}
