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
import { speakerCredits } from "./speaker-credits";
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

  it("gives single-name handles and organisations no page", () => {
    for (const name of ["Winter", "axstrm", "Red Hat", "Linutronix GmbH", ""]) {
      assert.equal(isSpeakerPageName(name), false, name);
    }
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
