import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSearchIndex, type IndexSource } from "./build";
import { decodeSearchIndex } from "./decode";
import { archiveSearchHref, canonicalPath, hrefFromQuery, isIndexableQuery } from "./href";
import { parseSearchParams, parseTalkId, searchParamsFromRecord } from "./params";
import { getTalkById, searchTalks } from "./query";

const ORIGIN = "https://cybertalks.org";

function talk(over: Partial<IndexSource> & { youtubeId: string }): IndexSource {
  const eventSlug = over.eventSlug ?? "defcon-30";
  const villageSlug = over.villageSlug ?? "main";
  const youtubeId = over.youtubeId;
  return {
    id: `${eventSlug}-${villageSlug}-${youtubeId}`,
    slug: over.slug ?? `slug-${youtubeId}`,
    title: over.title ?? "Untitled talk",
    speakers: over.speakers ?? [],
    teaser: over.teaser ?? "",
    year: over.year ?? 2024,
    conference: over.conference ?? "defcon",
    eventSlug,
    eventShortName: over.eventShortName ?? "DC30",
    villageSlug,
    villageName: over.villageName ?? "Main Stage",
    track: over.track ?? "malware",
    trackName: over.trackName ?? "Malware",
    topics: over.topics ?? [],
    difficulty: over.difficulty,
    kind: over.kind ?? "talk",
    youtubeId,
  };
}

function run(entries: IndexSource[], qs: string) {
  const built = buildSearchIndex(entries);
  const index = decodeSearchIndex(built.bytes);
  const parsed = parseSearchParams(new URLSearchParams(qs));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("unreachable");
  return {
    built,
    index,
    parsed,
    result: searchTalks(index, parsed.query, built.meta, ORIGIN),
  };
}

describe("search param validation", () => {
  it("defaults sort, page, and page size", () => {
    const parsed = parseSearchParams(new URLSearchParams("q=ransomware"));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.query.terms, ["ransomware"]);
    assert.equal(parsed.query.sort, "relevance");
    assert.equal(parsed.query.page, 1);
    assert.equal(parsed.query.pageSize, 24);
  });

  it("rejects unknown difficulty and non-enum sorts", () => {
    const difficulty = parseSearchParams(new URLSearchParams("difficulty=unknown"));
    assert.equal(difficulty.ok, false);
    if (!difficulty.ok) assert.equal(difficulty.field, "difficulty");

    const mixed = parseSearchParams(new URLSearchParams("difficulty=advanced,unknown"));
    assert.equal(mixed.ok, false);

    const sort = parseSearchParams(new URLSearchParams("sort=views"));
    assert.equal(sort.ok, false);
    if (!sort.ok) assert.equal(sort.field, "sort");
  });

  it("accepts the four difficulty levels, case-insensitively", () => {
    const parsed = parseSearchParams(new URLSearchParams("difficulty=Advanced,expert"));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.query.difficulties, ["advanced", "expert"]);
  });

  it("rejects bad years, pages, and page sizes", () => {
    assert.equal(parseSearchParams(new URLSearchParams("year=1800")).ok, false);
    assert.equal(parseSearchParams(new URLSearchParams("year=24")).ok, false);
    assert.equal(parseSearchParams(new URLSearchParams("page=0")).ok, false);
    assert.equal(parseSearchParams(new URLSearchParams("page=201")).ok, false);
    assert.equal(parseSearchParams(new URLSearchParams("pageSize=0")).ok, false);
    assert.equal(parseSearchParams(new URLSearchParams("pageSize=51")).ok, false);
  });

  it("parses repeated and comma-separated filters", () => {
    const params = new URLSearchParams("year=2024&year=2023&conference=defcon,black-hat&topic=ransomware&topic=cloud");
    const parsed = parseSearchParams(params);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.query.years, [2024, 2023]);
    assert.deepEqual(parsed.query.conferences, ["defcon", "black-hat"]);
    assert.deepEqual(parsed.query.topics, ["ransomware", "cloud"]);
  });

  it("rejects a query that is only stopwords", () => {
    const parsed = parseSearchParams(new URLSearchParams("q=the"));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.field, "q");
  });

  it("drops stopwords and splits hyphenated words", () => {
    const parsed = parseSearchParams(new URLSearchParams("q=the supply-chain"));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.query.terms, ["supply", "chain"]);
  });

  it("rejects a talk id with a path trick", () => {
    assert.equal(parseTalkId("../etc/passwd").ok, false);
    assert.equal(parseTalkId("defcon-30-main-abcdefghijk").ok, true);
  });

  it("reads array search params the way Next passes them", () => {
    const params = searchParamsFromRecord({
      q: "osint",
      year: ["2024", "2025"],
      difficulty: "advanced",
    });
    const parsed = parseSearchParams(params);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.query.years, [2024, 2025]);
    assert.equal(parsed.query.q, "osint");
  });
});

describe("search urls", () => {
  it("round-trips a shareable search url", () => {
    const href = archiveSearchHref({
      q: "ransomware",
      years: [2024],
      conferences: ["defcon"],
      tracks: ["malware"],
      topics: ["ransomware"],
      difficulties: ["advanced"],
      sort: "newest",
    });
    assert.equal(
      href,
      "/search?q=ransomware&year=2024&conference=defcon&track=malware&topic=ransomware&difficulty=advanced&sort=newest",
    );
    const parsed = parseSearchParams(new URLSearchParams(href.split("?")[1]));
    assert.equal(parsed.ok, true);
  });

  it("indexes a bare query and noindexes a filtered page", () => {
    const bare = parseSearchParams(new URLSearchParams("q=ransomware"));
    assert.equal(bare.ok, true);
    if (!bare.ok) return;
    assert.equal(isIndexableQuery(bare.query), true);
    assert.equal(canonicalPath(bare.query), "/search?q=ransomware");

    const deep = parseSearchParams(new URLSearchParams("q=ransomware&year=2024&page=2"));
    assert.equal(deep.ok, true);
    if (!deep.ok) return;
    assert.equal(isIndexableQuery(deep.query), false);
    assert.equal(canonicalPath(deep.query), "/search?q=ransomware");
    assert.equal(hrefFromQuery({ ...bare.query, page: 1 }), "/search?q=ransomware");
  });
});

describe("search index", () => {
  const entries: IndexSource[] = [
    talk({
      youtubeId: "aaaaaaaaaaa",
      title: "Ransomware payments",
      year: 2020,
      speakers: ["Ann"],
      topics: ["ransomware"],
      difficulty: "advanced",
      villageName: "Alpha",
    }),
    talk({
      youtubeId: "bbbbbbbbbbb",
      title: "Other notes",
      year: 2024,
      speakers: ["Ransomware Bob"],
      topics: ["cloud"],
      difficulty: "beginner",
      villageName: "Beta",
    }),
    talk({
      youtubeId: "ccccccccccc",
      title: "Notes on nothing",
      year: 2024,
      speakers: ["Cara"],
      topics: ["ransomware", "cloud"],
      difficulty: "expert",
      conference: "black-hat",
      eventSlug: "black-hat-24",
      eventShortName: "BH24",
      villageSlug: "briefings",
      villageName: "Briefings",
      track: "appsec",
      trackName: "AppSec",
    }),
    talk({
      youtubeId: "ddddddddddd",
      title: "Unclassified intro",
      year: 2023,
      topics: ["history"],
    }),
    talk({
      youtubeId: "eeeeeeeeeee",
      title: "Channel recording",
      year: 2025,
      eventSlug: "defcon-channel",
      eventShortName: "Channel",
      villageSlug: "channel",
      villageName: "Channel",
    }),
    talk({
      youtubeId: "fffffffffff",
      title: "A short clip",
      kind: "clip",
    }),
  ];

  it("indexes talks and omits clips", () => {
    const { result, built } = run(entries, "");
    assert.equal(built.meta.sourceRecords, entries.length);
    assert.equal(built.meta.talks, 5);
    assert.equal(built.meta.kinds.clip, 1);
    assert.equal(result.total, 5);
    assert.equal(result.results.some((hit) => hit.title === "A short clip"), false);
    assert.deepEqual(
      result.facets.difficulties.map((facet) => facet.value),
      ["beginner", "intermediate", "advanced", "expert"],
    );
    assert.equal(result.facets.difficulties.some((facet) => facet.value === "unknown"), false);
  });

  it("ranks title hits ahead of speaker and topic hits", () => {
    const { result } = run(entries, "q=ransomware");
    assert.deepEqual(
      result.results.map((hit) => hit.title),
      ["Ransomware payments", "Other notes", "Notes on nothing"],
    );
    assert.equal(result.results[0].url, `${ORIGIN}/talks/slug-aaaaaaaaaaa`);
  });

  it("ignores stopwords in an otherwise useful query", () => {
    const { result } = run(entries, "q=the+ransomware");
    assert.equal(result.total, 3);
    assert.deepEqual(result.query.terms, ["ransomware"]);
  });

  it("sorts newest with channel recordings after scheduled talks", () => {
    const { result } = run(entries, "sort=newest");
    assert.equal(result.results.at(-1)?.title, "Channel recording");
    assert.ok((result.results[0].year ?? 0) >= 2023);
    assert.notEqual(result.results[0].title, "Channel recording");
  });

  it("filters by year, conference, track, topic, and difficulty", () => {
    const year = run(entries, "year=2024");
    assert.equal(year.result.total, 2);
    assert.ok(year.result.facets.years.some((facet) => facet.value === 2023 && facet.count === 1));

    const both = run(entries, "conference=defcon,black-hat");
    assert.equal(both.result.total, 5);

    const track = run(entries, "track=appsec");
    assert.deepEqual(track.result.results.map((hit) => hit.title), ["Notes on nothing"]);

    const topic = run(entries, "topic=ransomware,cloud");
    assert.deepEqual(topic.result.results.map((hit) => hit.title), ["Notes on nothing"]);

    const level = run(entries, "difficulty=advanced");
    assert.deepEqual(level.result.results.map((hit) => hit.title), ["Ransomware payments"]);
    assert.equal(
      level.result.results.some((hit) => hit.difficulty == null),
      false,
    );
  });

  it("paginates", () => {
    const { result } = run(entries, "pageSize=2&page=2&sort=newest");
    assert.equal(result.total, 5);
    assert.equal(result.results.length, 2);
    assert.equal(result.page, 2);
    assert.equal(result.totalPages, 3);
  });

  it("looks up a talk by id and misses clips", () => {
    const built = buildSearchIndex(entries);
    const index = decodeSearchIndex(built.bytes);
    const id = "defcon-30-main-aaaaaaaaaaa";
    const found = getTalkById(index, id, ORIGIN);
    assert.ok(found);
    assert.equal(found?.title, "Ransomware payments");
    assert.equal(found?.difficulty, "advanced");
    assert.equal(found?.youtubeId, "aaaaaaaaaaa");
    assert.equal(found?.url, `${ORIGIN}/talks/slug-aaaaaaaaaaa`);
    assert.equal(getTalkById(index, "defcon-30-main-fffffffffff", ORIGIN), null);
    assert.equal(getTalkById(index, "missing-id-00000000000", ORIGIN), null);
  });
});
