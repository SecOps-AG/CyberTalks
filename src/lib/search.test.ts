import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFacets,
  createTextMatcher,
  EMPTY_FILTERS,
  filterTalks,
  markSummaryMatches,
  matchText,
  withHaystack,
  withSummaries,
} from "./search";
import type { TalkIndexEntry } from "./types";

function talk(id: string, title: string, extra: Partial<TalkIndexEntry> = {}): TalkIndexEntry {
  return {
    id,
    slug: id,
    title,
    speakers: ["Ada Lovelace"],
    youtubeId: "aaaaaaaaaaa",
    year: 2024,
    eventSlug: "defcon-32",
    conference: "defcon",
    eventShortName: "DC32",
    villageSlug: "main",
    villageName: "Main",
    track: "",
    trackName: "",
    topics: ["malware"],
    kind: "talk",
    ...extra,
  };
}

const talks = [
  talk("a", "Ransomware Negotiations"),
  talk("b", "Supply Chain Attacks", { topics: ["supply-chain"], year: 2023 }),
  talk("c", "Kernel Fuzzing"),
  talk("d", "Ransom Notes Clip", { kind: "clip" }),
];

describe("search speed paths", () => {
  it("reuses search entries for talks it has already seen", () => {
    const first = withHaystack(talks);
    const second = withHaystack(talks);
    assert.equal(first[0], second[0]);
  });

  it("folds summaries into the search text without a query", () => {
    const entries = withSummaries(withHaystack(talks), new Map([["c", "Covers syzkaller and eBPF."]]));
    assert.deepEqual(
      filterTalks(entries, { ...EMPTY_FILTERS, q: "syzkaller" }).map((e) => e.id),
      ["c"],
    );
    const marked = markSummaryMatches(entries, "syzkaller");
    assert.equal(marked.find((e) => e.id === "c")?.matchedInSummary, true);
    assert.equal(marked.find((e) => e.id === "a")?.matchedInSummary, undefined);
  });

  it("gives the same answer when typing forward reuses earlier matches", () => {
    const entries = withHaystack(talks);
    const matcher = createTextMatcher();
    for (const q of ["r", "ra", "ran", "rans", "ransom", "ransomware", "ransom", "", "supply ch", "supply chain"]) {
      assert.deepEqual(
        matcher(entries, q, false).map((e) => e.id),
        matchText(entries, q, false).map((e) => e.id),
        q,
      );
    }
    assert.deepEqual(matcher(entries, "ransom", true).map((e) => e.id), ["a", "d"]);
  });

  it("counts facets the same with or without a precomputed text match", () => {
    const entries = withHaystack(talks);
    const filters = { ...EMPTY_FILTERS, q: "a", years: [2024] };
    assert.deepEqual(
      computeFacets(entries, filters),
      computeFacets(entries, filters, {}, matchText(entries, filters.q, filters.includeExtras)),
    );
    // Year is picked, so its own counts ignore the year filter.
    const years = computeFacets(entries, filters).years.map((y) => [y.value, y.count]);
    assert.deepEqual(years, [
      [2024, 2],
      [2023, 1],
    ]);
  });
});
