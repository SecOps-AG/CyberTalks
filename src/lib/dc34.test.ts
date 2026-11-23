import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBanner } from "../components/SiteBanner";
import routes from "../generated/page-routes.json";
import stats from "../generated/stats.json";
import { DC34_BANNER, DC34_EVENT_SLUG, DC34_PATH, dc34BannerText } from "./dc34";
import { loadEventPage } from "./page-runtime";
import {
  countActive,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToQuery,
  filterTalks,
  withHaystack,
} from "./search";
import { sitemapPaths } from "./sitemap-build";
import type { TalkIndexEntry } from "./types";

describe("DEF CON 34 banner", () => {
  it("keeps the approved sentence and fills in the talk count", () => {
    assert.equal(
      dc34BannerText(12),
      "DEF CON 34 talks are here: 12 talks, summarized and searchable.",
    );
    assert.equal(
      dc34BannerText(1200),
      "DEF CON 34 talks are here: 1,200 talks, summarized and searchable.",
    );
    assert.equal(dc34BannerText(0), "DEF CON 34 talks are here, summarized and searchable.");
    assert.equal(dc34BannerText(null), "DEF CON 34 talks are here, summarized and searchable.");
    assert.equal(DC34_BANNER.href, "/defcon-34");
    assert.equal(DC34_PATH, "/defcon-34");
  });

  it("renders the build-time count from the DEF CON 34 talk list, with a single link", async () => {
    const page = await loadEventPage(DC34_EVENT_SLUG);
    assert.ok(page);
    assert.equal(stats.dc34Talks, page.talks.length);
    assert.ok(stats.dc34Talks > 0);
    const approved = `${dc34BannerText(stats.dc34Talks)} ${DC34_BANNER.linkLabel}`;
    const html = renderToStaticMarkup(createElement(SiteBanner));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)];
    assert.equal(links.length, 1);
    assert.equal(links[0][1], "/defcon-34");
    assert.equal(links[0][2], "Browse DEF CON 34");
    assert.equal(html.replace(/<[^>]+>/g, ""), approved);
    assert.match(html, new RegExp(`${stats.dc34Talks.toLocaleString("en-US")} talks`));
  });

  it("hides the count when it is missing or zero", () => {
    const html = renderToStaticMarkup(createElement(SiteBanner, { talkCount: 0 }));
    const text = html.replace(/<[^>]+>/g, "");
    assert.equal(text.includes("0 talks"), false);
    assert.equal(
      text,
      `DEF CON 34 talks are here, summarized and searchable. ${DC34_BANNER.linkLabel}`,
    );
    assert.equal(html.includes('href="/defcon-34"'), true);
  });
});

describe("DEF CON 34 page route", () => {
  it("is a static event route and in the sitemap", () => {
    assert.ok(routes.events.includes(DC34_EVENT_SLUG));
    const paths = sitemapPaths({
      events: routes.events.map((slug) => ({ slug })),
      editions: [],
      villages: [],
      tracks: [],
      talks: [],
      speakers: [],
      topics: [],
    });
    assert.ok(paths.includes("/defcon-34"));
  });
});

function entry(over: Partial<TalkIndexEntry> & Pick<TalkIndexEntry, "id" | "youtubeId">): TalkIndexEntry {
  return {
    slug: over.id,
    title: over.id,
    teaser: "",
    speakers: [],
    year: 2026,
    eventSlug: DC34_EVENT_SLUG,
    conference: "defcon",
    eventShortName: "DC34",
    villageSlug: "aerospace-village",
    villageName: "Aerospace Village",
    track: "hardware",
    kind: "talk",
    topics: [],
    ...over,
  } as TalkIndexEntry;
}

describe("DEF CON 34 filters", () => {
  const talks = withHaystack([
    entry({ id: "yt", youtubeId: "sbkeEwhWIks" }),
    entry({ id: "media", youtubeId: "dc34-371097c2" }),
    entry({ id: "media-slides", youtubeId: "dc34-9a8b7c6d", hasSlides: true }),
    entry({ id: "yt-repo", youtubeId: "AbCdEfGhIjK", hasRepo: true }),
  ]);
  const ids = (patch: Partial<typeof EMPTY_FILTERS>) =>
    filterTalks(talks, { ...EMPTY_FILTERS, ...patch }).map((talk) => talk.id);

  it("Not on YouTube keeps only media-archive recordings", () => {
    assert.deepEqual(ids({}), ["yt", "media", "media-slides", "yt-repo"]);
    assert.deepEqual(ids({ notYouTube: true }), ["media", "media-slides"]);
  });

  it("combines with the materials filters", () => {
    assert.deepEqual(ids({ hasSlides: true }), ["media-slides"]);
    assert.deepEqual(ids({ hasRepo: true }), ["yt-repo"]);
    assert.deepEqual(ids({ notYouTube: true, hasSlides: true }), ["media-slides"]);
    assert.deepEqual(ids({ notYouTube: true, hasRepo: true }), []);
  });

  it("round-trips through the URL and counts as active", () => {
    const query = filtersToQuery({ ...EMPTY_FILTERS, notYouTube: true, hasSlides: true });
    assert.equal(query, "slides=1&notyoutube=1");
    const parsed = filtersFromParams(new URLSearchParams(query));
    assert.equal(parsed.notYouTube, true);
    assert.equal(parsed.hasSlides, true);
    assert.equal(countActive(parsed), 2);
    assert.equal(filtersFromParams(new URLSearchParams("")).notYouTube, false);
  });
});
