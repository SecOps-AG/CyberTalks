import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DC34_EVENT_SLUG } from "./dc34";
import {
  DC34_LIKE_WEIGHT,
  PAGE_SIZE,
  dc34PopularScore,
  initialBrowse,
  paginate,
  sortTalks,
} from "./search";
import type { SearchEntry, TalkIndexEntry } from "./types";

function entry(
  partial: Partial<TalkIndexEntry> & Pick<TalkIndexEntry, "id" | "title">,
): SearchEntry {
  return {
    id: partial.id,
    slug: partial.id,
    title: partial.title,
    speakers: [],
    youtubeId: partial.youtubeId ?? "aaaaaaaaaaa",
    year: partial.year ?? 2024,
    eventSlug: partial.eventSlug ?? "defcon-33",
    conference: partial.conference ?? "defcon",
    eventShortName: "DC",
    villageSlug: partial.villageSlug ?? "main",
    villageName: partial.villageName ?? "Main",
    track: "",
    trackName: "",
    topics: [],
    kind: "talk",
    haystack: "",
    speakerSlugs: [],
    ...(partial.viewCount != null ? { viewCount: partial.viewCount } : {}),
    ...(partial.likeCount != null ? { likeCount: partial.likeCount } : {}),
  };
}

describe("DEF CON 34 homepage score", () => {
  it("uses log10(views + 1) plus a small likes-per-view boost", () => {
    const views = 1000;
    const likes = 50;
    const score = dc34PopularScore({ viewCount: views, likeCount: likes });
    assert.equal(DC34_LIKE_WEIGHT, 2);
    assert.ok(score != null);
    assert.ok(Math.abs(score - (Math.log10(views + 1) + 2 * (likes / views))) < 1e-12);
  });

  it("treats a missing view count as unscored and a missing like count as zero", () => {
    assert.equal(dc34PopularScore({}), null);
    assert.equal(dc34PopularScore({ likeCount: 10 }), null);
    const viewsOnly = dc34PopularScore({ viewCount: 1000 });
    assert.ok(viewsOnly != null);
    assert.ok(Math.abs(viewsOnly - Math.log10(1001)) < 1e-12);
    assert.equal(dc34PopularScore({ viewCount: 0, likeCount: 4 }), 0);
  });
});

describe("homepage first page", () => {
  it("pins the highest-scoring DEF CON 34 talks and leaves the rest in the old order", () => {
    const older = Array.from({ length: 6 }, (_, index) =>
      entry({
        id: `old-${index}`,
        title: `Older ${index}`,
        year: 2020,
        villageName: `V${index}`,
        viewCount: 5_000_000,
        likeCount: 100_000,
      }),
    );
    const popular = entry({
      id: "popular",
      title: "Popular",
      eventSlug: DC34_EVENT_SLUG,
      year: 2026,
      villageName: "Zed",
      viewCount: 100_000,
      likeCount: 1_000,
    });
    const quiet = entry({
      id: "quiet",
      title: "Quiet",
      eventSlug: DC34_EVENT_SLUG,
      year: 2026,
      villageName: "Alpha",
      viewCount: 100,
      likeCount: 50,
    });
    const uncounted = entry({
      id: "uncounted",
      title: "Uncounted",
      eventSlug: DC34_EVENT_SLUG,
      year: 2026,
      villageName: "Alpha",
    });
    const filler = Array.from({ length: PAGE_SIZE }, (_, index) =>
      entry({
        id: `fill-${index}`,
        title: `Fill ${String(index).padStart(2, "0")}`,
        eventSlug: DC34_EVENT_SLUG,
        year: 2026,
        villageName: "Middle",
        viewCount: 10_000 - index,
        likeCount: 100,
      }),
    );

    const input = [uncounted, quiet, ...older, popular, ...filler];
    const plain = sortTalks(input, "relevance", "").map((talk) => talk.id);
    const pinned = sortTalks(input, "relevance", "", { pinPopularDc34: true });
    const page = paginate(pinned, 1).items;

    assert.equal(page.length, PAGE_SIZE);
    assert.ok(page.every((talk) => talk.eventSlug === DC34_EVENT_SLUG));
    assert.equal(page[0].id, "popular");
    assert.equal(page[1].id, "fill-0");
    assert.ok(!page.some((talk) => talk.id === "quiet" || talk.id === "uncounted"));
    assert.ok(!page.some((talk) => talk.id.startsWith("old-")));

    const pinnedIds = new Set(page.map((talk) => talk.id));
    const rest = pinned.slice(PAGE_SIZE).map((talk) => talk.id);
    assert.deepEqual(
      rest,
      plain.filter((id) => !pinnedIds.has(id)),
    );
  });

  it("leaves a chosen sort and a search alone", () => {
    const talks = [
      entry({ id: "new", title: "New", eventSlug: DC34_EVENT_SLUG, year: 2026, viewCount: 10 }),
      entry({ id: "watched", title: "Watched", year: 2020, viewCount: 99999 }),
    ];
    assert.deepEqual(
      sortTalks(talks, "views", "", { pinPopularDc34: true }).map((talk) => talk.id),
      ["watched", "new"],
    );
    assert.equal(sortTalks(talks, "relevance", "watched", { pinPopularDc34: true })[0].id, "watched");
  });

  it("keeps the full conference list in the first-load facets when page 1 is only DEF CON 34", () => {
    const dc34 = Array.from({ length: PAGE_SIZE + 2 }, (_, index) =>
      entry({
        id: `dc34-${index}`,
        title: `DC34 ${index}`,
        eventSlug: DC34_EVENT_SLUG,
        year: 2026,
        viewCount: 10_000 - index,
      }),
    );
    const others = [
      entry({ id: "bh", title: "Black Hat", year: 2024, conference: "black-hat", eventSlug: "black-hat-2024", viewCount: 50 }),
      entry({ id: "rsa", title: "RSA", year: 2023, conference: "rsa", eventSlug: "rsa-2023", viewCount: 40 }),
    ];
    const initial = initialBrowse([...dc34, ...others], { pinPopularDc34: true });
    assert.equal(initial.talks.length, PAGE_SIZE);
    assert.ok(initial.talks.every((talk) => talk.eventSlug === DC34_EVENT_SLUG));
    assert.equal(initial.facets.conferences.length, 3);
    assert.deepEqual(
      initial.facets.conferences.map((option) => option.value).sort(),
      ["black-hat", "defcon", "rsa"],
    );
  });
});
