import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeJsonLd, isoDuration, jsonLdString, speakerJsonLd, talkJsonLd } from "./json-ld";
import { llmsTxt } from "./llms-txt";
import { homeMetadata, pageMetadata } from "./page-meta";
import { wwwRedirectTarget } from "./www-redirect";

const baseTalk = {
  slug: "a-talk",
  title: "A Talk",
  teaser: "Our own one-line teaser.",
  speakers: ["Ada Lovelace", "Alan Turing"],
  villageName: "Recon Village",
  eventName: "DEF CON 33",
  eventSlug: "defcon-33",
  conference: "defcon",
  year: 2025,
  youtubeId: "dQw4w9WgXcQ",
  mediaUrl: null,
  durationSeconds: 3725,
  publishedAt: "2026-11-06",
  language: "en",
  topics: ["osint", "recon"],
};

describe("pageMetadata", () => {
  const meta = pageMetadata({ title: "DEF CON", description: "Hub text.", path: "/defcon" });

  it("sets an absolute canonical and matching og:url", () => {
    assert.equal(meta.alternates?.canonical, "https://cybertalks.org/defcon");
    assert.equal((meta.openGraph as { url: string }).url, "https://cybertalks.org/defcon");
  });

  it("fills every Open Graph and Twitter field with the default card", () => {
    const og = meta.openGraph as Record<string, unknown>;
    assert.equal(og.type, "website");
    assert.equal(og.title, "DEF CON — Cyber Talks");
    assert.equal(og.description, "Hub text.");
    const images = og.images as { url: string; width: number; height: number }[];
    assert.equal(images[0].url, "https://cybertalks.org/og-default.png");
    assert.deepEqual([images[0].width, images[0].height], [1200, 630]);
    const tw = meta.twitter as Record<string, unknown>;
    assert.equal(tw.card, "summary_large_image");
    assert.equal(tw.title, "DEF CON — Cyber Talks");
    assert.deepEqual(tw.images, ["https://cybertalks.org/og-default.png"]);
  });

  it("uses the bare site title and a trailing-slash canonical for the home page", () => {
    const home = pageMetadata({ description: "Site text.", path: "/" });
    assert.equal(home.title, undefined);
    assert.equal(home.alternates?.canonical, "https://cybertalks.org/");
    assert.equal((home.openGraph as { title: string }).title, "Cyber Talks");
  });
});

describe("homeMetadata", () => {
  it("leaves the URL tags to the page so the root keeps its trailing slash", () => {
    const home = homeMetadata("Site text.");
    assert.equal(home.alternates, undefined);
    assert.ok(!("url" in (home.openGraph as object)));
    assert.equal((home.openGraph as { title: string }).title, "Cyber Talks");
    assert.equal(home.description, "Site text.");
  });
});

describe("json-ld", () => {
  it("home has a WebSite with a search action and an Organization", () => {
    const [site, org] = homeJsonLd();
    assert.equal(site["@type"], "WebSite");
    const action = site.potentialAction as { target: { urlTemplate: string }; "query-input": string };
    assert.equal(action.target.urlTemplate, "https://cybertalks.org/search?q={search_term_string}");
    assert.equal(action["query-input"], "required name=search_term_string");
    assert.equal(org["@type"], "Organization");
    assert.equal(org.url, "https://cybertalks.org/");
  });

  it("a YouTube talk is a VideoObject with an embed URL and the teaser", () => {
    const ld = talkJsonLd(baseTalk);
    assert.equal(ld["@type"], "VideoObject");
    assert.equal(ld.description, "Our own one-line teaser.");
    assert.equal(ld.embedUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ");
    assert.equal(ld.thumbnailUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    assert.equal(ld.duration, "PT1H2M5S");
    assert.equal(ld.uploadDate, "2026-11-06");
    assert.equal(ld.url, "https://cybertalks.org/talks/a-talk");
  });

  it("a media-archive talk is a VideoObject with a content URL and an absolute poster", () => {
    const ld = talkJsonLd({ ...baseTalk, youtubeId: "dc33-371097c2", mediaUrl: "https://media.defcon.org/x.mp4" });
    assert.equal(ld["@type"], "VideoObject");
    assert.equal(ld.contentUrl, "https://media.defcon.org/x.mp4");
    assert.equal(ld.embedUrl, undefined);
    assert.equal(ld.thumbnailUrl, "https://cybertalks.org/materials/thumbs/dc33-371097c2.jpg");
  });

  it("a talk with no video is a CreativeWork without video fields", () => {
    const ld = talkJsonLd({ ...baseTalk, youtubeId: "", mediaUrl: null });
    assert.equal(ld["@type"], "CreativeWork");
    assert.equal(ld.embedUrl, undefined);
    assert.equal(ld.thumbnailUrl, undefined);
    assert.equal(ld.duration, undefined);
    assert.equal(ld.datePublished, "2026-11-06");
    assert.equal(ld.uploadDate, undefined);
  });

  it("falls back to a factual line, and omits dates and duration it does not have", () => {
    const ld = talkJsonLd({ ...baseTalk, teaser: undefined, publishedAt: undefined, durationSeconds: undefined });
    assert.equal(
      ld.description,
      "Ada Lovelace and Alan Turing at DEF CON 33 (Recon Village): OSINT, recon. Watch the video on Cyber Talks.",
    );
    assert.equal(ld.uploadDate, undefined);
    assert.equal(ld.duration, undefined);
  });

  it("a speaker is a Person", () => {
    const ld = speakerJsonLd({ slug: "ada-lovelace", name: "Ada Lovelace" });
    assert.equal(ld["@type"], "Person");
    assert.equal(ld.url, "https://cybertalks.org/speakers/ada-lovelace");
    assert.equal(ld.name, "Ada Lovelace");
  });

  it("serialises to JSON that survives a closing script tag in a title", () => {
    const text = jsonLdString(talkJsonLd({ ...baseTalk, title: "</script><b>x</b>" }));
    assert.ok(!text.includes("</script>"));
    assert.equal(JSON.parse(text).name, "</script><b>x</b>");
  });

  it("formats durations", () => {
    assert.equal(isoDuration(45), "PT45S");
    assert.equal(isoDuration(3600), "PT1H");
    assert.equal(isoDuration(125), "PT2M5S");
    assert.equal(isoDuration(0), undefined);
    assert.equal(isoDuration(undefined), undefined);
  });
});

describe("wwwRedirectTarget", () => {
  it("sends www to the apex, keeping path and query", () => {
    assert.equal(
      wwwRedirectTarget("www.cybertalks.org", "/search", "?q=ransomware&year=2024"),
      "https://cybertalks.org/search?q=ransomware&year=2024",
    );
    assert.equal(wwwRedirectTarget("WWW.CyberTalks.org:443", "/", ""), "https://cybertalks.org/");
  });

  it("leaves the apex, other hosts, and a missing host alone", () => {
    assert.equal(wwwRedirectTarget("cybertalks.org", "/", ""), null);
    assert.equal(wwwRedirectTarget("localhost:3044", "/", ""), null);
    assert.equal(wwwRedirectTarget("www.example.com", "/", ""), null);
    assert.equal(wwwRedirectTarget(null, "/", ""), null);
  });
});

describe("llmsTxt", () => {
  const text = llmsTxt("https://cybertalks.org");

  it("links the sitemap and the main sections", () => {
    assert.ok(text.includes("https://cybertalks.org/sitemap.xml"));
    for (const path of ["/defcon", "/black-hat", "/bsides", "/tracks", "/topics", "/speakers", "/search"]) {
      assert.ok(text.includes(`https://cybertalks.org${path}`), path);
    }
  });

  it("says it is unofficial and unaffiliated", () => {
    assert.match(text, /unofficial/i);
    assert.match(text, /not affiliated with, endorsed by, or an official source/i);
  });

  it("stays short", () => {
    assert.ok(text.split("\n").length < 40);
  });
});
