import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(__dirname, "../..");

function readTalk(file: string, slug: string) {
  const village = JSON.parse(fs.readFileSync(path.join(root, "data/villages", file), "utf8")) as {
    talks: Record<string, unknown>[];
  };
  return village.talks.find((talk) => talk.slug === slug);
}

describe("event-title repair", () => {
  it("gives /talks/usa-2001-5 its real title, year and edition, without touching the video or slug", () => {
    const talk = readTalk("channel-black-hat-ucj6q9ie-2025-black-hat.json", "usa-2001-5");
    assert.ok(talk);
    assert.equal(talk.title, "SQL Security Revisited");
    assert.equal(talk.year, 2001);
    assert.equal(talk.eventLabel, "Black Hat USA 2001");
    assert.deepEqual(talk.speakers, []);
    assert.equal(talk.youtubeId, "c6Xx43wSXno");
    assert.equal("teaser" in talk, false, "the generated teaser repeated the event label");
  });

  it("leaves a good teaser and a summary alone on an affected talk", () => {
    const talk = readTalk("channel-black-hat-ucj6q9ie-2025-black-hat.json", "usa-2013-9");
    assert.ok(talk);
    assert.equal(talk.year, 2013);
    assert.match(String(talk.teaser), /cookie policy/);
    assert.ok(talk.summary);
  });

  it("is already applied: a second run finds nothing left to change", () => {
    const out = execFileSync("node", [path.join(root, "scripts/fix-event-titles.mjs")], { encoding: "utf8" });
    const report = JSON.parse(out) as { counts: Record<string, number> };
    assert.equal(report.counts.yearChanged, 0);
    assert.equal(report.counts.titleRecovered, 0);
    assert.equal(report.counts.teaserDropped, 0);
  });
});
