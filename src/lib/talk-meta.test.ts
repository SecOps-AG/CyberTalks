import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DESCRIPTION_LENGTH, clip, isBoilerplateTeaser, talkDescription } from "./talk-description";
import {
  TITLE_MAX,
  withoutEditionTag,
  buildTitleIndex,
  eventYearLabel,
  shortenName,
  talkDocumentTitle,
  type TalkTitleFields,
} from "./talk-title";

function talk(over: Partial<TalkTitleFields> & Pick<TalkTitleFields, "title">): TalkTitleFields {
  return { eventName: "DEF CON 33", year: 2025, villageName: "Main Stage", speakers: ["Ada Lovelace"], slug: "x", ...over };
}

describe("event year label", () => {
  it("does not repeat a year the event name already has", () => {
    assert.equal(eventYearLabel({ eventName: "DEF CON 33", year: 2025 }), "DEF CON 33");
    assert.equal(eventYearLabel({ eventName: "Black Hat USA 2024", year: 2024 }), "Black Hat USA 2024");
  });
  it("adds the talk's year to a bare event name, and prefers an explicit edition label", () => {
    assert.equal(eventYearLabel({ eventName: "AUSCERT", year: 2020 }), "AUSCERT 2020");
    assert.equal(
      eventYearLabel({ eventName: "Black Hat", year: 2001, eventLabel: "Black Hat USA 2001" }),
      "Black Hat USA 2001",
    );
  });
});

describe("talk document title", () => {
  it("is '<Talk> | <Event Year>' with the site name only when it still fits", () => {
    assert.equal(
      talkDocumentTitle(talk({ title: "SQL Security Revisited", eventName: "Black Hat", year: 2001, eventLabel: "Black Hat USA 2001" })),
      "SQL Security Revisited | Black Hat USA 2001 — Cyber Talks",
    );
    const long = talkDocumentTitle(talk({ title: "Breaking Things With Cheap Radios And Patience" }));
    assert.equal(long, "Breaking Things With Cheap Radios And Patience | DEF CON 33");
    assert.ok(long.length <= TITLE_MAX);
  });

  it("shortens a long talk name at a word boundary and never drops the event", () => {
    const title = talkDocumentTitle(
      talk({
        title:
          "A Very Long Talk Name That Keeps Going Well Past Any Reasonable Limit For A Search Result Title",
      }),
    );
    assert.ok(title.length <= TITLE_MAX, title);
    assert.ok(title.endsWith("… | DEF CON 33"), title);
    assert.ok(title.startsWith("A Very Long Talk Name That"), title);
  });

  it("is deterministic and keeps the distinctive start of the name", () => {
    assert.equal(shortenName("Short", 20), "Short");
    assert.equal(shortenName("Abcdefghij klmnopqrst uvwxyz", 20), "Abcdefghij…");
    assert.equal(shortenName("Supercalifragilisticexpialidocious", 12), "Supercalifr…");
  });

  it("uses the longer of name and label alone when one contains the other", () => {
    assert.equal(
      talkDocumentTitle(talk({ title: "2020 Day 2", eventName: "AUSCERT", year: 2020, eventLabel: "AUSCERT 2020 Day 2" })),
      "AUSCERT 2020 Day 2 — Cyber Talks",
    );
  });

  it("drops a leading edition tag the label already states, but keeps a name that would be left empty", () => {
    assert.equal(
      talkDocumentTitle(
        talk({ title: "BSidesSF 2023 - Data Masking at Scale", eventName: "Security BSides San Francisco", year: 2023 }),
      ),
      "Data Masking at Scale | Security BSides San Francisco 2023",
    );
    assert.equal(withoutEditionTag("RSA Conference 2010 Keynote", "RSAC 2010"), "RSA Conference 2010 Keynote");
    assert.equal(withoutEditionTag("USA 2012 - Rooting SIM Cards", "Black Hat USA 2012"), "Rooting SIM Cards");
    assert.equal(withoutEditionTag("2019 predictions and more", "Some Event 2020"), "2019 predictions and more");
  });

  it("adds the first speaker when two talks share a title and event, if it fits", () => {
    const a = talk({ title: "Hallway", eventName: "SAINTCON", year: 2025, speakers: ["Max Power"], slug: "a" });
    const b = talk({ title: "Hallway", eventName: "SAINTCON", year: 2025, speakers: ["Naomi Brockwell"], slug: "b" });
    const index = buildTitleIndex([a, b, talk({ title: "Other" })]);
    assert.equal(index.sameTitle.length, 1);
    assert.equal(talkDocumentTitle(a, index), "Hallway — Max Power | SAINTCON 2025 — Cyber Talks");
    assert.notEqual(talkDocumentTitle(a, index), talkDocumentTitle(b, index));
    assert.equal(talkDocumentTitle(talk({ title: "Other" }), index), "Other | DEF CON 33 — Cyber Talks");
  });
});

describe("talk description", () => {
  const base = {
    title: "Rooting SIM Cards",
    speakers: ["Karsten Nohl"],
    villageName: "Main Stage",
    eventName: "DEF CON 33",
    eventSlug: "defcon-33",
    conference: "defcon",
    year: 2025,
    topics: ["telecom", "hardware"],
  };

  it("starts from our summary, drops markdown, and stops near 150 characters", () => {
    const summary = `### Overview\nThe talk shows how **SIM cards** can be attacked over the air. ${"More detail follows here. ".repeat(20)}`;
    const text = talkDescription({ ...base, summary, teaser: "A teaser." });
    assert.ok(text.startsWith("The talk shows how SIM cards can be attacked over the air."), text);
    assert.ok(text.length <= DESCRIPTION_LENGTH, String(text.length));
    assert.ok(text.endsWith("…"));
    assert.ok(!text.includes("#") && !text.includes("*"));
  });

  it("drops a leading label, a leading timestamp, and an AI-summary credit", () => {
    const labelled = talkDescription({ ...base, summary: "**Overview:** CSRF remains a threat. (AI summary — Example Model)" });
    assert.equal(labelled, "CSRF remains a threat.");
    assert.equal(
      talkDescription({ ...base, summary: "At 00:00, Ada Lovelace opens the talk." }),
      "Ada Lovelace opens the talk.",
    );
  });

  it("uses a real teaser but not the generated frame around the title", () => {
    assert.equal(
      talkDescription({ ...base, summary: null, teaser: "See how a cookie policy limits cross-origin session abuse." }),
      "See how a cookie policy limits cross-origin session abuse.",
    );
    const generated = talkDescription({
      ...base,
      summary: null,
      teaser: "Industry experts analyze emerging threats surrounding Rooting SIM Cards.",
    });
    assert.ok(!/Industry experts|emerging threats/.test(generated), generated);
    assert.equal(
      generated,
      "Karsten Nohl at DEF CON 33 (Main Stage): telecom, hardware. Watch the video on Cyber Talks.",
    );
  });

  it("recognises the generated teaser frames and leaves real sentences alone", () => {
    const t = { title: "USA 2001 Talk", speakers: ["Ada Lovelace"] };
    for (const teaser of [
      "Security researchers examine technical aspects of USA 2001 Talk.",
      "Analysts investigate attack surfaces and defenses concerning USA 2001 Talk.",
      "Presenters detail vulnerability discovery and exploitation in USA 2001 Talk.",
      "Engineers explore architecture and security mechanisms for USA 2001 Talk.",
      "Details USA 2001 Talk and evaluates key implications for security practitioners.",
      "Ada Lovelace explores USA 2001 Talk.",
      "Coverage of USA 2001 Talk from the conference program.",
      "USA 2001 Talk.",
      "Security researchers investigate USA 2001 Talk and analyze defensive countermeasures.",
    ]) {
      assert.equal(isBoilerplateTeaser(teaser, t), true, teaser);
    }
    assert.equal(
      isBoilerplateTeaser("Learn how adversary characterization can shape risk assessments.", t),
      false,
    );
  });

  it("builds a factual fallback without speakers when none read like people", () => {
    const text = talkDescription({
      ...base,
      speakers: ["Social Engineering Trends"],
      villageName: "Black Hat",
      conference: "black-hat",
      eventSlug: "channel-black-hat-2025",
      eventName: "Black Hat",
      eventLabel: "Black Hat USA 2001",
      year: 2001,
      title: "Hacking",
      summary: null,
      teaser: undefined,
    });
    assert.equal(text, "Talk from Black Hat USA 2001: telecom, hardware. Watch the video on Cyber Talks.");
  });

  it("clips on a word boundary", () => {
    assert.equal(clip("one two three four five six", 15), "one two three…");
    assert.equal(clip("short", 15), "short");
  });
});
