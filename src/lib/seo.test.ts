import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalUrl } from "./canonical";
import { initialBrowse, INITIAL_FACET_LIMIT, PAGE_SIZE } from "./search";
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
import {
  TOPIC_FILTER_LIMIT,
  TOPIC_FEATURED,
  TOPIC_INDEX_MIN,
  TOPIC_PAGE_SIZE,
  topicIndexView,
  topicIsIndexable,
  topicPageValue,
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

describe("topic index paging", () => {
  const vocabulary: TopicEntry[] = [
    ...Array.from({ length: TOPIC_PAGE_SIZE * 2 + 5 }, (_, index) => ({
      topic: `hub-${String(index).padStart(4, "0")}`,
      label: `Hub ${index}`,
      count: 3 + (index % 7),
    })),
    ...Array.from({ length: 300 }, (_, index) => ({
      topic: `thin-${String(index).padStart(4, "0")}`,
      label: `Thin ${index}`,
      count: 1 + (index % 2),
    })),
  ].sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
  const hubTotal = TOPIC_PAGE_SIZE * 2 + 5;

  it("lists one page of hubs and keeps the full hub count", () => {
    const first = topicIndexView(vocabulary, "", 1);
    assert.equal(first.listed.length, TOPIC_PAGE_SIZE);
    assert.equal(first.hubCount, hubTotal);
    assert.equal(first.totalMatches, hubTotal);
    assert.equal(first.totalPages, 3);
    assert.equal(first.from, 1);
    assert.equal(first.to, TOPIC_PAGE_SIZE);
    assert.equal(first.featured.length, TOPIC_FEATURED);
    assert.ok(first.listed.every((entry) => entry.count >= TOPIC_INDEX_MIN));
  });

  it("pages through every hub once, in order, with no thin topics", () => {
    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      seen.push(...topicIndexView(vocabulary, "", page).listed.map((entry) => entry.topic));
    }
    assert.equal(seen.length, hubTotal);
    assert.equal(new Set(seen).size, hubTotal);
    assert.deepEqual(seen, [...seen].sort());
  });

  it("shows the featured strip on the first page only and clamps a page past the end", () => {
    const later = topicIndexView(vocabulary, "", 2);
    assert.equal(later.featured.length, 0);
    assert.equal(later.from, TOPIC_PAGE_SIZE + 1);
    const last = topicIndexView(vocabulary, "", 3);
    assert.equal(last.listed.length, 5);
    assert.equal(last.to, hubTotal);
    assert.equal(topicIndexView(vocabulary, "", 99).page, 3);
  });

  it("ignores the page number while a query is active and still searches the long tail", () => {
    const view = topicIndexView(vocabulary, "thin", 3);
    assert.equal(view.page, 1);
    assert.equal(view.totalPages, 1);
    assert.equal(view.totalMatches, 300);
    assert.equal(view.listed.length, TOPIC_FILTER_LIMIT);
    assert.equal(view.truncated, true);
    assert.equal(view.hubCount, hubTotal);
  });

  it("reads ?page= defensively", () => {
    assert.equal(topicPageValue(undefined), 1);
    assert.equal(topicPageValue("3"), 3);
    assert.equal(topicPageValue(["4", "5"]), 4);
    assert.equal(topicPageValue("0"), 1);
    assert.equal(topicPageValue("-2"), 1);
    assert.equal(topicPageValue("2abc"), 1);
    assert.equal(topicPageValue("99999999999"), 1);
  });
});

describe("listing page first load", () => {
  const baseTalk = {
    teaser: "Teaser text that would otherwise be repeated for every talk.",
    youtubeId: "abc",
    eventSlug: "defcon-32",
    conference: "defcon",
    eventShortName: "DC32",
    villageSlug: "main",
    villageName: "Main",
    track: "t",
    trackName: "Track",
    kind: "talk" as const,
  };
  const talks = Array.from({ length: 300 }, (_, index) => ({
    ...baseTalk,
    id: `talk-${index}`,
    slug: `talk-${index}`,
    title: `Talk ${index}`,
    speakers: [`Speaker ${index}`, "Shared Speaker"],
    year: 2000 + (index % 20),
    topics: ["focus", ...Array.from({ length: 60 }, (_, topic) => `t${(index + topic) % 150}`)],
  }));

  it("sends one page of talks and a bounded facet set", () => {
    const first = initialBrowse(talks);
    assert.equal(first.talks.length, PAGE_SIZE);
    assert.equal(first.total, talks.length);
    assert.equal(first.facets.years.length, 20);
    assert.equal(first.facets.topics.length, INITIAL_FACET_LIMIT);
    assert.equal(first.facets.speakers.length, INITIAL_FACET_LIMIT);
    assert.equal(first.facets.topics[0].value, "focus");
    assert.equal(first.facets.topics[0].count, talks.length);
    assert.equal(first.facets.speakers[0].label, "Shared Speaker");
    assert.ok(JSON.stringify(first).length < JSON.stringify(talks).length / 4);
  });
});

describe("sitemap paths", () => {
  const paths = sitemapPaths({
    events: [{ slug: "defcon-32" }],
    editions: [{ eventSlug: "defcon-32", villageSlug: "recon" }],
    villages: [{ slug: "recon" }],
    tracks: [{ slug: "malware" }],
    talks: [
      { slug: "alpha", conference: "defcon", summary: null },
      { slug: "alpha", conference: "defcon", summary: null },
      { slug: "beta", conference: "defcon", summary: "A written summary." },
      { slug: "gamma", conference: "linux-foundation", summary: "A written summary." },
      { slug: "unsummarised", conference: "linux-foundation", summary: null },
      { slug: "blank", conference: "proidea", summary: "  " },
      { slug: "repeat", conference: "linux-foundation", summary: null },
      { slug: "repeat", conference: "linux-foundation", summary: "Later row, same slug." },
    ],
    speakers: [
      { slug: "ada", talkCount: 2 },
      { slug: "", talkCount: 4 },
      { slug: "ghost", talkCount: 0 },
      { slug: "solo", talkCount: 1 },
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

  it("leaves out every page that carries noindex: one-talk speakers and summary-less talks outside the priority conferences", () => {
    assert.equal(paths.includes("/speakers/solo"), false);
    assert.ok(paths.includes("/talks/alpha"), "priority conference stays without a summary");
    assert.ok(paths.includes("/talks/beta"));
    assert.ok(paths.includes("/talks/gamma"), "a summary keeps a long-tail talk indexable");
    assert.equal(paths.includes("/talks/unsummarised"), false);
    assert.equal(paths.includes("/talks/blank"), false);
    // The first row with a slug is the one the page renders.
    assert.equal(paths.includes("/talks/repeat"), false);
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
