import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBanner } from "../components/SiteBanner";
import routes from "../generated/page-routes.json";
import { DC34_BANNER, DC34_EVENT_SLUG, DC34_PATH } from "./dc34";
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

const APPROVED =
  "DEF CON 34 talks are here: 354 talks, summarized and searchable. Browse DEF CON 34";

describe("DEF CON 34 banner", () => {
  it("uses the approved sentence and links only to /defcon-34", () => {
    assert.equal(`${DC34_BANNER.text} ${DC34_BANNER.linkLabel}`, APPROVED);
    assert.equal(DC34_BANNER.href, "/defcon-34");
    assert.equal(DC34_PATH, "/defcon-34");
  });

  it("renders the sentence with a single link", () => {
    const html = renderToStaticMarkup(createElement(SiteBanner));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)];
    assert.equal(links.length, 1);
    assert.equal(links[0][1], "/defcon-34");
    assert.equal(links[0][2], "Browse DEF CON 34");
    assert.equal(html.replace(/<[^>]+>/g, ""), APPROVED);
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
      talkSlugs: [],
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
