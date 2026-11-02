import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { buildSearchIndex, type IndexSource } from "../search-index/build";
import { decodeSearchIndex } from "../search-index/decode";
import { ensureSchema, syncRows } from "./apply";
import {
  chooseSearchSource,
  decodeSearchChunks,
  encodeSearchChunks,
  readStoredSearchIndex,
  searchIndexStatements,
  sha256Hex,
} from "./search-store";
import type { SqlClient, Statement } from "./sql";

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

test("a newer D1 index wins, and a deploy that is ahead keeps its asset index", () => {
  assert.equal(chooseSearchSource(null, 10), "assets");
  assert.equal(chooseSearchSource(11, 10), "d1");
  assert.equal(chooseSearchSource(10, 10), "d1");
  assert.equal(chooseSearchSource(9, 10), "assets");
  assert.equal(chooseSearchSource(4, null), "d1");
});

test("search index chunks round-trip through D1", async () => {
  const source: IndexSource = {
    id: "defcon-33-dc33-media-dc33-371097c2",
    slug: "dc33-blind-trailer-shouting",
    title: "Blind Trailer Shouting",
    speakers: ["Ben Gardiner"],
    year: 2025,
    conference: "defcon",
    eventSlug: "defcon-33",
    eventShortName: "DC33",
    villageSlug: "dc33-media",
    villageName: "DEF CON 33 media",
    track: "",
    topics: [],
    kind: "talk",
    youtubeId: "dc33-371097c2",
  };
  const built = buildSearchIndex([source]);
  const parts = encodeSearchChunks(built.bytes);
  assert.ok(parts.length >= 1);
  assert.deepEqual(decodeSearchChunks(parts), built.bytes);

  const db = new DatabaseSync(":memory:");
  const sql = sqlite(db);
  await ensureSchema(sql);
  const sha = await sha256Hex(built.bytes);
  await sql.batch(searchIndexStatements(parts, sha, built.meta.talks, JSON.stringify(built.meta)));
  const stored = await readStoredSearchIndex(sql);
  assert.ok(stored);
  assert.equal(stored.talks, 1);
  assert.equal(stored.sha, sha);
  const index = decodeSearchIndex(stored.bytes);
  assert.equal(index.docCount, 1);
});

test("sync writes material rows and the slides flag", async () => {
  const { rowFromTalk } = await import("./rows");
  const db = new DatabaseSync(":memory:");
  const sql = sqlite(db);
  await ensureSchema(sql);
  const row = rowFromTalk(
    {
      id: "defcon-33-dc33-media-sbkeEwhWIks",
      slug: "dc33-claude-climbing-a-ctf-scoreboard",
      title: "Claude--Climbing a CTF Scoreboard Near You",
      youtubeId: "sbkeEwhWIks",
      speakers: ["Keane Lucas"],
      track: "",
      topics: [],
      kind: "talk",
      villageId: "defcon-33-dc33-media",
      villageSlug: "dc33-media",
      villageName: "DEF CON 33 media",
      eventSlug: "defcon-33",
      conference: "defcon",
      eventName: "DEF CON 33",
      eventShortName: "DC33",
      year: 2025,
      youtubeUrl: "https://www.youtube.com/watch?v=sbkeEwhWIks",
      trackName: "",
      dateLabel: "Aug 2025",
      locationLabel: "Las Vegas",
      summary: "A talk.",
      materials: [
        {
          type: "slides",
          url: "https://media.defcon.org/slides.pdf",
          source: "media.defcon.org",
          confidence: 0.96,
        },
        {
          type: "reference",
          url: "https://example.com/",
          source: "defcon.org",
          confidence: 0.5,
        },
      ],
    },
    "data/villages/defcon-33-dc33-media.json",
    1,
    [],
  );
  assert.equal(row.hasSlides, 1);
  assert.equal(row.hasRepo, 0);
  const stats = await syncRows(sql, [row]);
  assert.equal(stats.written, 1);
  const flags = db.prepare("SELECT has_slides, has_repo FROM talks").get() as {
    has_slides: number;
    has_repo: number;
  };
  assert.equal(flags.has_slides, 1);
  const links = db.prepare("SELECT type, label FROM talk_materials ORDER BY position").all() as {
    type: string;
    label: string;
  }[];
  assert.equal(links.length, 2);
  assert.equal(links[0].type, "slides");
  assert.equal(links[0].label.endsWith(".pdf"), true);
  const again = await syncRows(sql, [row]);
  assert.equal(again.written, 0);
  assert.equal(again.unchanged, 1);
  const still = db.prepare("SELECT COUNT(*) AS n FROM talk_materials").get() as { n: number };
  assert.equal(still.n, 2);
});
