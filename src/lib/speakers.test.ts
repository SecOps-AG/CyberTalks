import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPEAKER_INDEX_MIN,
  isPriorityConference,
  speakerIsIndexable,
  speakerRobots,
  talkHasSummary,
  talkIsIndexable,
  talkRobots,
} from "./indexability";
import { getSpeakers, getTalks } from "./data";
import { ONE_WORD_SPEAKER_TALKS, countOneWordSpeakers, speakerCredits, speakerVerdict } from "./speaker-credits";
import { cleanSpeakerName, isLikelyPersonSpeaker, isSpeakerPageName, speakerPageVerdict } from "./speakerHeuristics";

describe("speaker names", () => {
  it("keeps ordinary people, including accents and particles", () => {
    for (const name of [
      "Ada Lovelace",
      "Mixæl Laufer",
      "Gilad Ben-Yossef",
      "Greg Kroah-Hartman",
      "Wilco van Ginkel",
      "Christophe de Dinechin",
      "Do Truong Giang",
      "Jayson E Street",
      "Fermin J. Serna",
    ]) {
      assert.equal(isSpeakerPageName(name), true, name);
    }
  });

  it("rejects talk titles, topics and event strings that were credited as speakers", () => {
    for (const name of [
      "Social Engineering Trends",
      "3D Accelerated Exploitation",
      "Automated Compliance",
      "Ultimate Mobile OPSEC",
      "Dystrybucja zróżnicowanych ścieżek BGP",
      "Deep Learning in Computer Vision",
      "Practical Exploitation of Embedded Systems",
      "Going Dark",
      "Web Performance",
      "Anatomy of Automated Account Takeovers",
      "Jupyter Notebooks",
      "CRESTCon UK",
      "Jina AI",
      "Minions vs. GRU",
      "Presenter: Ian Mitchell, Founder",
      "Adrian and Alex",
    ]) {
      assert.equal(isSpeakerPageName(name), false, name);
      assert.equal(isLikelyPersonSpeaker(name), false, name);
    }
  });

  it("strips a trailing '| Event' credit and country tag, and invents nothing", () => {
    assert.equal(cleanSpeakerName("Matteo Rebeschini | CypherCon 6.0"), "Matteo Rebeschini");
    assert.equal(cleanSpeakerName("Marcin Ratajczyk [PL]"), "Marcin Ratajczyk");
    assert.equal(cleanSpeakerName("  Ada   Lovelace, "), "Ada Lovelace");
    const verdict = speakerPageVerdict("Matteo Rebeschini | CypherCon 6.0");
    assert.deepEqual([verdict.ok, verdict.name], [true, "Matteo Rebeschini"]);
  });

  it("rejects a credit that equals the talk's own title, event or village", () => {
    const ctx = { title: "Rooting SIM Cards", eventName: "Black Hat", villageName: "Recon Village" };
    assert.equal(speakerPageVerdict("Rooting SIM Cards", ctx).ok, false);
    assert.equal(speakerPageVerdict("Recon Village", ctx).ok, false);
    assert.equal(speakerPageVerdict("Black Hat", ctx).reason, "matches_talk_field");
    assert.equal(speakerPageVerdict("Karsten Nohl", ctx).ok, true);
  });

  it("gives single-name handles and organisations no page unless they recur", () => {
    for (const name of ["Winter", "axstrm", "Red Hat", "Linutronix GmbH", ""]) {
      assert.equal(isSpeakerPageName(name), false, name);
      assert.equal(isSpeakerPageName(name, {}, { oneWordTalks: 1 }), false, name);
    }
    assert.equal(speakerPageVerdict("Winter", {}, { oneWordTalks: 1 }).reason, "one_word_single_talk");
  });

  it("keeps a one-word credit with two or more talks", () => {
    for (const name of ["Winter", "axstrm", "Zoz", "CauseEffect", "egypt"]) {
      assert.equal(isSpeakerPageName(name, {}, { oneWordTalks: 2 }), true, name);
      assert.equal(isSpeakerPageName(name, {}, { oneWordTalks: 9 }), true, name);
    }
    assert.equal(speakerPageVerdict("Zoz | DEF CON 13", {}, { oneWordTalks: 2 }).name, "Zoz");
  });

  it("still drops junk when a single word has many talks", () => {
    const many = { oneWordTalks: 50 };
    for (const name of [
      "Panel", "Keynote", "Interview", "Welcome", "Unknown", "Various", "TBA", "Staff", "Hallway",
      "DEFCON", "Black Hat", "BSides", "Security", "Village", "Google", "2024", "Q&A", "Anonymous",
      "Moderator", "of", "Undisclosed",
    ]) {
      assert.equal(isSpeakerPageName(name, {}, many), false, name);
    }
    // Same word as the talk's own title, event or village.
    assert.equal(isSpeakerPageName("Mimicry", { title: "Mimicry" }, many), false);
    assert.equal(isSpeakerPageName("Cryptography", { villageName: "Cryptography" }, many), false);
    assert.equal(isSpeakerPageName("Hacktivity", { eventName: "Hacktivity" }, many), false);
  });
});

describe("speaker credits on a talk", () => {
  it("returns one cleaned entry per slug and skips junk", () => {
    const credits = speakerCredits({
      title: "Hacking the Planet",
      eventName: "DEF CON 33",
      speakers: ["Ada Lovelace", "ada  lovelace", "Matteo Rebeschini | CypherCon 6.0", "Social Engineering Trends", "Hacking the Planet"],
    });
    assert.deepEqual(
      credits.map((credit) => credit.slug),
      ["ada-lovelace", "matteo-rebeschini"],
    );
    assert.equal(credits[1].name, "Matteo Rebeschini");
  });
});

describe("one-word speaker counts", () => {
  const talk = (id: string, speakers: string[], extra: { title?: string } = {}) => ({
    title: extra.title ?? `Talk ${id}`,
    eventName: "DEF CON 33",
    speakers,
  });
  const talks = [
    talk("a", ["Zoz", "Ada Lovelace"]),
    talk("b", ["Zoz | DEF CON 13", "zoz"]),
    talk("c", ["Lonely"]),
    talk("d", ["Panel", "Ada Lovelace"]),
    talk("e", ["Panel"]),
    talk("f", ["Mimicry"], { title: "Mimicry" }),
    talk("g", ["Mimicry"]),
  ];

  it("counts talks per slug the way the speaker index does", () => {
    // "Zoz" appears twice on talk b but is one talk; Lonely has one talk; Panel is a title word;
    // Mimicry is the title of talk f, so only talk g counts for it.
    assert.deepEqual(countOneWordSpeakers(talks), { zoz: 2 });
  });

  it("makes every consumer agree with the count map", () => {
    const counts = countOneWordSpeakers(talks);
    const slugs = (index: number) => speakerCredits(talks[index], counts).map((credit) => credit.slug);
    assert.deepEqual(slugs(0), ["zoz", "ada-lovelace"]);
    assert.deepEqual(slugs(1), ["zoz"]);
    assert.deepEqual(slugs(2), []);
    assert.deepEqual(slugs(3), ["ada-lovelace"]);
    assert.deepEqual(slugs(6), []);
    assert.equal(speakerVerdict("Zoz", {}, counts).ok, true);
    assert.equal(speakerVerdict("Lonely", {}, counts).ok, false);
    assert.equal(speakerVerdict("Zoz", {}, counts).slug, "zoz");
    // A page-level check with the same map gives the same answer as the credit list.
    const indexed = new Map<string, number>();
    for (const t of talks) for (const { slug } of speakerCredits(t, counts)) indexed.set(slug, (indexed.get(slug) ?? 0) + 1);
    assert.equal(indexed.get("zoz"), counts.zoz);
  });
});

describe("one-word speakers in the catalog", () => {
  it("matches the committed count map (run `npm run generate-shards` after a data change)", () => {
    assert.deepEqual(ONE_WORD_SPEAKER_TALKS, countOneWordSpeakers(getTalks()));
  });

  it("gives every one-word speaker page at least two talks and lists no one-talk handle", () => {
    const oneWord = getSpeakers().filter((speaker) => !/\s/.test(speaker.name));
    assert.ok(oneWord.length > 0);
    for (const speaker of oneWord) {
      assert.ok(speaker.talkCount >= SPEAKER_INDEX_MIN, `${speaker.slug} has ${speaker.talkCount}`);
      assert.equal(ONE_WORD_SPEAKER_TALKS[speaker.slug], speaker.talkCount, speaker.slug);
    }
    assert.equal(getSpeakers().some((speaker) => speaker.slug === "axstrm"), false);
  });
});

describe("indexability", () => {
  it("noindexes speakers with fewer than two talks", () => {
    assert.equal(SPEAKER_INDEX_MIN, 2);
    assert.equal(speakerIsIndexable(1), false);
    assert.equal(speakerIsIndexable(2), true);
    assert.deepEqual(speakerRobots(1), { index: false, follow: true });
    assert.deepEqual(speakerRobots(5), { index: true, follow: true });
  });

  it("treats null, empty, blank and empty-object summaries as missing, and a teaser as no summary", () => {
    assert.equal(talkHasSummary(null), false);
    assert.equal(talkHasSummary(undefined), false);
    assert.equal(talkHasSummary(""), false);
    assert.equal(talkHasSummary("   \n"), false);
    assert.equal(talkHasSummary({}), false);
    assert.equal(talkHasSummary({ overview: "", bullets: [] }), false);
    assert.equal(talkHasSummary("### Overview\nA real summary."), true);
    assert.equal(talkHasSummary({ overview: "A real summary." }), true);
    assert.equal(talkHasSummary({ bullets: ["one"] }), true);
  });

  it("recognises the priority conferences", () => {
    for (const slug of ["defcon", "black-hat", "bsides", "rsa", "rsac", "troopers", "bsides-sf"]) {
      assert.equal(isPriorityConference(slug), true, slug);
    }
    for (const slug of ["linux-foundation", "proidea", "community", "owasp", "defconx"]) {
      assert.equal(isPriorityConference(slug), false, slug);
    }
  });

  it("indexes a summary-less talk only at a priority conference", () => {
    assert.equal(talkIsIndexable({ conference: "defcon", summary: null }), true);
    assert.equal(talkIsIndexable({ conference: "linux-foundation", summary: null }), false);
    assert.equal(talkIsIndexable({ conference: "linux-foundation", summary: "Text." }), true);
    assert.deepEqual(talkRobots({ conference: "proidea", summary: "" }), { index: false, follow: true });
    assert.deepEqual(talkRobots({ conference: "black-hat", summary: "" }), { index: true, follow: true });
  });
});
