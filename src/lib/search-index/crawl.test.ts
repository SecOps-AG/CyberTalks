import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateMetadata } from "../../app/search/page";
import robots from "../../app/robots";
import { SearchScreen } from "../../components/search/SearchScreen";
import type { SearchResponse } from "./model";
import type { SearchQuery } from "./params";

const query: SearchQuery = {
  q: "",
  terms: [],
  years: [],
  conferences: [],
  tracks: [],
  topics: [],
  difficulties: [],
  sort: "relevance",
  page: 1,
  pageSize: 24,
};

const result: SearchResponse = {
  query: {
    q: "",
    terms: [],
    year: [],
    conference: [],
    track: [],
    topic: [],
    difficulty: [],
    sort: "relevance",
    page: 1,
    pageSize: 24,
  },
  total: 30,
  page: 1,
  pageSize: 24,
  totalPages: 2,
  results: [
    {
      id: "1",
      slug: "example-talk",
      title: "Example talk",
      speakers: ["Ada"],
      year: 2024,
      conference: "defcon",
      conferenceLabel: "DEF CON",
      event: "DC32",
      track: "malware",
      trackName: "Malware",
      topics: ["ransomware"],
      difficulty: "advanced",
      url: "https://cybertalks.org/talks/example-talk",
    },
  ],
  facets: {
    years: [{ value: 2024, label: "2024", count: 10 }],
    conferences: [{ value: "defcon", label: "DEF CON", count: 10 }],
    tracks: [{ value: "malware", label: "Malware", count: 4 }],
    topics: [{ value: "ransomware", label: "Ransomware", count: 3 }],
    topicsTruncated: false,
    topicTotal: 1,
    difficulties: [{ value: "advanced", label: "Advanced", count: 2 }],
  },
};

function anchors(html: string): { href: string; rel: string | null; text: string }[] {
  const out: { href: string; rel: string | null; text: string }[] = [];
  const pattern = /<a\b([^>]*)>(.*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1];
    const href = /href="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const rel = /rel="([^"]*)"/.exec(attrs)?.[1] ?? null;
    out.push({ href: href.replaceAll("&amp;", "&"), rel, text: match[2] });
  }
  return out;
}

function ruleList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Google uses the longest matching Allow/Disallow rule. A tie prefers Allow. */
function crawlDecision(path: string, allow: string[], disallow: string[]): "allow" | "disallow" {
  const matched = [
    ...allow.filter((rule) => path.startsWith(rule)).map((rule) => ({ rule, kind: "allow" as const })),
    ...disallow.filter((rule) => path.startsWith(rule)).map((rule) => ({ rule, kind: "disallow" as const })),
  ];
  if (matched.length === 0) return "allow";
  const longest = Math.max(...matched.map((item) => item.rule.length));
  const winners = matched.filter((item) => item.rule.length === longest);
  return winners.some((item) => item.kind === "allow") ? "allow" : "disallow";
}

describe("search crawl policy", () => {
  it("disallows parameterized search urls and leaves content paths open", () => {
    const body = robots();
    const rules = Array.isArray(body.rules) ? body.rules : [body.rules];
    const star = rules.find((rule) => rule.userAgent === "*");
    assert.ok(star);
    const allow = ruleList(star.allow);
    const disallow = ruleList(star.disallow);
    assert.ok(allow.includes("/"));
    assert.deepEqual(disallow, ["/search?"]);
    assert.equal(body.sitemap, "https://cybertalks.org/sitemap.xml");

    const decision = (path: string) => crawlDecision(path, allow, disallow);
    assert.equal(decision("/search"), "allow");
    assert.equal(decision("/search?year=2024"), "disallow");
    assert.equal(decision("/search?q=ransomware"), "disallow");
    assert.equal(decision("/search?year=2024&conference=defcon&page=3"), "disallow");
    for (const path of [
      "/",
      "/talks/example-talk",
      "/speakers/ada",
      "/tracks/malware",
      "/topics/ransomware",
      "/defcon",
      "/defcon/villages/main-stage",
      "/black-hat",
    ]) {
      assert.equal(decision(path), "allow", path);
    }
  });

  it("noindexes search variants and canonicalizes them to /search", async () => {
    const clean = await generateMetadata({ searchParams: Promise.resolve({}) });
    assert.deepEqual(clean.robots, { index: true, follow: true });
    assert.equal(clean.alternates?.canonical, "https://cybertalks.org/search");

    const keyword = await generateMetadata({
      searchParams: Promise.resolve({ q: "ransomware", year: "2024", page: "2" }),
    });
    assert.deepEqual(keyword.robots, { index: false, follow: true });
    assert.equal(keyword.alternates?.canonical, "https://cybertalks.org/search");

    const invalid = await generateMetadata({
      searchParams: Promise.resolve({ difficulty: "nope" }),
    });
    assert.deepEqual(invalid.robots, { index: false, follow: true });
    assert.equal(invalid.alternates?.canonical, "https://cybertalks.org/search");
  });

  it("nofollows facet, sort, and page links and leaves talk links alone", () => {
    const html = renderToStaticMarkup(
      createElement(SearchScreen, { error: null, query, result }) as ReactNode,
    );
    const links = anchors(html);
    const byHref = (href: string) => links.filter((link) => link.href === href);
    for (const href of [
      "/search?year=2024",
      "/search?conference=defcon",
      "/search?track=malware",
      "/search?difficulty=advanced",
      "/search?topic=ransomware",
      "/search?sort=newest",
      "/search?page=2",
    ]) {
      const found = byHref(href);
      assert.ok(found.length > 0, href);
      assert.ok(
        found.every((link) => link.rel === "nofollow"),
        `${href} rel=${found.map((link) => link.rel).join(",")}`,
      );
    }

    const talks = byHref("/talks/example-talk");
    assert.equal(talks.length, 1);
    assert.equal(talks[0].rel, null);

    const clean = byHref("/search");
    assert.ok(clean.length > 0);
    assert.ok(clean.every((link) => link.rel === null));
  });
});
