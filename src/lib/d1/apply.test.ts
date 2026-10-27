import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ensureSchema, syncRows } from "./apply";
import { readSpeakerRecord, readTalkBySlug, readTalkCount, readTopicTalks, readYearSummaries } from "./read";
import { rowFromTalk } from "./rows";
import { statementToSql, type SqlClient, type Statement } from "./sql";
import { speakerFromTalks } from "./speaker";
import type { Talk } from "../types";

function talk(overrides: Partial<Talk> & Pick<Talk, "id" | "slug" | "title">): Talk {
  return {
    youtubeId: overrides.youtubeId ?? overrides.id,
    speakers: [],
    track: "red-team",
    topics: ["locks"],
    kind: "talk",
    villageId: "defcon-33-lock-village",
    villageSlug: "lock-village",
    villageName: "Lock Village",
    eventSlug: "defcon-33",
    conference: "defcon",
    eventName: "DEF CON 33",
    eventShortName: "DC33",
    year: 2025,
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    trackName: "Red Team",
    dateLabel: "Aug 2025",
    locationLabel: "Las Vegas",
    ...overrides,
  };
}

function sqlite(db: DatabaseSync): SqlClient {
  return {
    async exec(sql: string) {
      db.exec(sql);
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(params as SQLInputValue[])) as T[];
    },
    async batch(statements: Statement[]) {
      if (statements.length === 0) return;
      db.exec("BEGIN");
      try {
        for (const statement of statements) {
          db.prepare(statement.sql).run(...(statement.params as SQLInputValue[]));
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("speaker spelling, village, and co-speaker follow the archive rules", () => {
  const talks = [
    talk({
      id: "a",
      slug: "a",
      title: "A",
      speakers: ["Ada Lovelace", "Grace Hopper"],
      year: 2024,
    }),
    talk({
      id: "b",
      slug: "b",
      title: "B",
      speakers: ["Ada Lovelace", "Grace Hopper"],
      year: 2025,
      conference: "black-hat",
      eventSlug: "black-hat-2025",
    }),
  ];
  const speaker = speakerFromTalks("ada-lovelace", talks);
  assert.ok(speaker);
  assert.equal(speaker.name, "Ada Lovelace");
  assert.equal(speaker.talkCount, 2);
  assert.deepEqual(speaker.villages, ["lock-village"]);
  assert.deepEqual(speaker.coSpeakers, ["grace-hopper"]);
  assert.equal(speaker.firstAppearance, 2024);
  assert.equal(speaker.lastAppearance, 2025);
});

test("SQL literals escape quotes and leave numbers alone", () => {
  const sql = statementToSql({
    sql: "INSERT INTO talks (id, view_count, summary_text) VALUES (?, ?, ?)",
    params: ["o'brien", null, "it's a talk"],
  });
  assert.equal(
    sql,
    "INSERT INTO talks (id, view_count, summary_text) VALUES ('o''brien', NULL, 'it''s a talk')",
  );
});

test("upsert is idempotent, then an edit and a removal show up", async () => {
  const db = sqlite(new DatabaseSync(":memory:"));
  await ensureSchema(db);
  const file = "data/villages/defcon-33-lock-village.json";
  const first = talk({
    id: "talk-1",
    slug: "opening-locks",
    title: "Opening locks",
    summary: "How a lock works.",
    speakers: ["Ada Lovelace"],
    topics: ["locks", "hardware"],
  });
  const second = talk({
    id: "talk-2",
    slug: "opening-locks",
    title: "Older lock talk",
    speakers: ["Grace Hopper"],
    year: 2020,
    eventSlug: "defcon-28",
    villageId: "defcon-28-lock-village",
  });
  const rows = [
    rowFromTalk(first, file, 2, []),
    rowFromTalk(second, file, 1, ["talk-1"]),
  ];

  const inserted = await syncRows(db, rows, [file]);
  assert.equal(inserted.written, 2);
  assert.equal(await readTalkCount(db), 2);

  const again = await syncRows(db, rows, [file]);
  assert.equal(again.written, 0);
  assert.equal(again.unchanged, 2);
  assert.equal(again.deleted, 0);

  const page = await readTalkBySlug(db, "opening-locks");
  assert.equal(page?.talk.title, "Older lock talk");
  assert.equal(page?.related[0]?.id, "talk-1");

  const topics = await readTopicTalks(db, "locks");
  assert.equal(topics.length, 2);

  const speaker = await readSpeakerRecord(db, "ada-lovelace");
  assert.equal(speaker?.speaker.name, "Ada Lovelace");
  assert.equal(speaker?.talks.length, 1);

  const summaries = await readYearSummaries(db, 2025);
  assert.deepEqual(summaries, [{ id: "talk-1", summary: "How a lock works." }]);

  const edited = talk({ ...first, title: "Opening locks today", summary: "A new summary." });
  const editedRows = [rowFromTalk(edited, file, 2, []), rowFromTalk(second, file, 1, ["talk-1"])];
  const updated = await syncRows(db, editedRows, [file]);
  assert.equal(updated.written, 1);
  assert.equal(updated.unchanged, 1);
  const after = await readTalkBySlug(db, "opening-locks");
  assert.equal(after?.talk.title, "Older lock talk");
  const byId = await db.all<{ title: string }>(
    "SELECT json_extract(body, '$.title') AS title FROM talks WHERE id = ?",
    ["talk-1"],
  );
  assert.equal(byId[0]?.title, "Opening locks today");

  const removed = await syncRows(db, [rowFromTalk(second, file, 1, [])], [file]);
  assert.equal(removed.deleted, 1);
  assert.equal(await readTalkCount(db), 1);
  assert.equal((await readTopicTalks(db, "hardware")).length, 0);
});
