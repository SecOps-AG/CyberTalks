import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalUrl } from "./canonical";
import { siteUrl } from "./site-url";
import {
  CATALOG_CACHE_CONTROL,
  catalogCacheHeaders,
  SEARCH_PAGE_CACHE_CONTROL,
  SEARCH_PAGE_CDN_CACHE_CONTROL,
  searchPageCacheHeaders,
} from "./http-cache";
import { chunkList, sitemapIndexXml, sitemapPaths, sitemapUrlset, SITEMAP_URL_LIMIT } from "./sitemap-build";
import { summaryYearsToLoad } from "./summary-years";
import { buildTitleIndex, talkDocumentTitle, type TalkTitleFields } from "./talk-title";
import {
  TOPIC_FILTER_LIMIT,
  TOPIC_INDEX_MIN,
  topicIndexView,
  topicIsIndexable,
  topicQueryValue,
  topicRobots,
  type TopicEntry,
} from "./topic-indexability";

const topics: TopicEntry[] = [
  { topic: "ransomware", label: "Ransomware", count: 40 },
  { topic: "osint", label: "OSINT", count: 3 },
  { topic: "hallway", label: "Hallway", count: 2 },
  { topic: "keynote", label: "Keynote", count: 1 },
];

function talk(partial: Partial<TalkTitleFields> & Pick<TalkTitleFields, "slug" | "title">): TalkTitleFields {
  return {
    eventName: "DEF CON 32",
    year: 2024,
    villageName: "Main Stage",
    speakers: ["Ada"],
    ...partial,
  };
}

describe("topic indexability", () => {
  it("noindexes topics with fewer than 3 talks and keeps larger hubs", () => {
    assert.equal(TOPIC_INDEX_MIN, 3);
    assert.equal(topicIsIndexable(1), false);
    assert.equal(topicIsIndexable(2), false);
    assert.equal(topicIsIndexable(3), true);
    assert.deepEqual(topicRobots(1), { index: false, follow: true });
    assert.deepEqual(topicRobots(3), { index: true, follow: true });
  });

  it("renders hubs in the default list and finds the long tail only through the filter", () => {
    const hubs = topicIndexView(topics, "");
    assert.deepEqual(
      hubs.listed.map((entry) => entry.topic),
      ["osint", "ransomware"],
    );
    assert.equal(hubs.featured[0]?.topic, "ransomware");
    assert.equal(hubs.truncated, false);

    const filtered = topicIndexView(topics, topicQueryValue("key"));
    assert.deepEqual(
      filtered.listed.map((entry) => entry.topic),
      ["keynote"],
    );
    assert.equal(filtered.totalMatches, 1);

    const byLabel = topicIndexView(topics, "hallway");
    assert.equal(byLabel.listed[0]?.topic, "hallway");
  });

  it("caps a broad filter so the HTML cannot hold the whole vocabulary", () => {
    const many = Array.from({ length: TOPIC_FILTER_LIMIT + 25 }, (_, index) => ({
      topic: `alpha-${String(index).padStart(4, "0")}`,
      label: `Alpha ${index}`,
      count: 1,
    }));
    const view = topicIndexView(many, "alpha");
    assert.equal(view.listed.length, TOPIC_FILTER_LIMIT);
    assert.equal(view.totalMatches, many.length);
    assert.equal(view.truncated, true);
    assert.equal(view.featured.length, 0);
  });
});

describe("talk document titles", () => {
  const talks = [
    talk({ slug: "only", title: "Unique talk" }),
    talk({ slug: "k1", title: "Keynote", eventName: "DEF CON 30", year: 2022 }),
    talk({ slug: "k2", title: "Keynote", eventName: "Black Hat USA 2024", year: 2024, villageName: "Briefings" }),
    talk({
      slug: "h1",
      title: "Hallway",
      eventName: "DEF CON 32",
      year: 2024,
      villageName: "Recon Village",
      speakers: ["Ann"],
    }),
    talk({
      slug: "h2",
      title: "Hallway",
      eventName: "DEF CON 32",
      year: 2024,
      villageName: "Crypto Village",
      speakers: ["Bea"],
    }),
    talk({
      slug: "p1",
      title: "Panel",
      eventName: "DEF CON 23",
      year: 2015,
      villageName: "Presentations",
      speakers: ["Ann"],
    }),
    talk({
      slug: "p2",
      title: "Panel",
      eventName: "DEF CON 23",
      year: 2015,
      villageName: "Presentations",
      speakers: ["Bea"],
    }),
    talk({
      slug: "c1",
      title: "Clip",
      eventName: "DEF CON 20",
      year: 2012,
      villageName: "Extras",
      speakers: [],
    }),
    talk({
      slug: "c2",
      title: "Clip",
      eventName: "DEF CON 20",
      year: 2012,
      villageName: "Extras",
      speakers: [],
    }),
  ];
  const index = buildTitleIndex(talks);

  it("leaves a one-off title alone and disambiguates reused titles with event and year", () => {
    assert.equal(talkDocumentTitle(talks[0], index), "Unique talk");
    assert.equal(talkDocumentTitle(talks[1], index), "Keynote — DEF CON 30 (2022)");
    assert.equal(talkDocumentTitle(talks[2], index), "Keynote — Black Hat USA 2024 (2024)");
  });

  it("adds village, speakers, then slug only when event and year still collide", () => {
    assert.equal(
      talkDocumentTitle(talks[3], index),
      "Hallway — DEF CON 32 (2024), Recon Village",
    );
    assert.equal(
      talkDocumentTitle(talks[5], index),
      "Panel — DEF CON 23 (2015), Presentations — Ann",
    );
    assert.equal(
      talkDocumentTitle(talks[7], index),
      "Clip — DEF CON 20 (2012), Extras — c1",
    );
    const titles = talks.map((item) => talkDocumentTitle(item, index));
    assert.equal(new Set(titles).size, titles.length);
  });
});

describe("sitemap paths", () => {
  const paths = sitemapPaths({
    events: [{ slug: "defcon-32" }],
    editions: [{ eventSlug: "defcon-32", villageSlug: "recon" }],
    villages: [{ slug: "recon" }],
    tracks: [{ slug: "malware" }],
    talkSlugs: ["alpha", "alpha", "beta"],
    speakers: [
      { slug: "ada", talkCount: 2 },
      { slug: "", talkCount: 4 },
      { slug: "ghost", talkCount: 0 },
    ],
    topics: [
      { topic: "ransomware", count: 3 },
      { topic: "hallway", count: 2 },
      { topic: "keynote", count: 1 },
    ],
  });

  it("includes talks, hubs, and speakers, and skips thin topics and search queries", () => {
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/search"));
    assert.ok(paths.includes("/talks/alpha"));
    assert.ok(paths.includes("/talks/beta"));
    assert.equal(paths.filter((path) => path === "/talks/alpha").length, 1);
    assert.ok(paths.includes("/topics/ransomware"));
    assert.ok(paths.includes("/speakers/ada"));
    assert.ok(paths.includes("/defcon"));
    assert.ok(paths.includes("/defcon-32"));
    assert.ok(paths.includes("/defcon-32/recon"));
    assert.equal(paths.some((path) => path.startsWith("/search?")), false);
    assert.equal(paths.some((path) => path.includes("?")), false);
    assert.equal(paths.includes("/topics/hallway"), false);
    assert.equal(paths.includes("/topics/keynote"), false);
    assert.equal(paths.includes("/saved"), false);
    assert.equal(paths.includes("/speakers/ghost"), false);
  });

  it("splits url sets under the sitemap limit and builds an index", () => {
    const chunks = chunkList(paths, 3);
    assert.ok(chunks.every((chunk) => chunk.length <= 3));
    assert.ok(chunks.flat().length === paths.length);
    assert.equal(SITEMAP_URL_LIMIT < 50_000, true);
    const index = sitemapIndexXml("https://cybertalks.org", 2);
    assert.match(index, /<sitemapindex/);
    assert.match(index, /https:\/\/cybertalks.org\/sitemaps\/0</);
    assert.match(index, /https:\/\/cybertalks.org\/sitemaps\/1</);
    assert.doesNotMatch(index, /<urlset/);
    const set = sitemapUrlset("https://cybertalks.org", ["/", "/talks/a&b"]);
    assert.match(set, /<loc>https:\/\/cybertalks.org\/<\/loc>/);
    assert.match(set, /https:\/\/cybertalks.org\/talks\/a&amp;b/);
    assert.doesNotMatch(set, /sitemapindex/);
  });
});

describe("cache headers", () => {
  it("makes catalog responses public and leaves errors uncached", () => {
    const ok = catalogCacheHeaders(200);
    assert.equal(ok["Cache-Control"], CATALOG_CACHE_CONTROL);
    assert.equal(ok["Cache-Control"].includes("no-store"), false);
    assert.equal(ok["CDN-Cache-Control"].includes("public"), true);
    assert.equal(catalogCacheHeaders(404)["Cache-Control"], "no-store");
  });

  it("caches search HTML briefly without no-store", () => {
    const headers = searchPageCacheHeaders();
    assert.equal(headers["Cache-Control"], SEARCH_PAGE_CACHE_CONTROL);
    assert.equal(headers["CDN-Cache-Control"], SEARCH_PAGE_CDN_CACHE_CONTROL);
    assert.equal(headers["Cache-Control"].includes("no-store"), false);
    assert.match(headers["Cache-Control"], /s-maxage=60/);
  });
});

describe("summary year loads", () => {
  it("fetches each year once even when the talk list changes", () => {
    const loaded = new Set<number>([2024]);
    assert.deepEqual(
      summaryYearsToLoad(loaded, [
        { year: 2024 },
        { year: 2025 },
        { year: 2025 },
        { year: 2023 },
      ]),
      [2025, 2023],
    );
    assert.deepEqual(summaryYearsToLoad(loaded, [{ year: 2024 }]), []);
  });
});

describe("canonicals", () => {
  it("points the homepage at the site root", () => {
    assert.equal(canonicalUrl("/"), `${siteUrl()}/`);
    assert.equal(canonicalUrl("/talks/keynote"), `${siteUrl()}/talks/keynote`);
  });
});
