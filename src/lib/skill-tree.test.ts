import assert from "node:assert/strict";
import { test } from "node:test";
import { hoursMinutes, layoutField, rankFor, talkStatus, type SkillField, type SkillTalk } from "./skill-tree";
import type { Difficulty } from "./types";

function talk(youtubeId: string, tier: Difficulty, durationSeconds = 1800, after: string[] = []): SkillTalk {
  return {
    id: `edition-${youtubeId}`,
    youtubeId,
    slug: youtubeId,
    title: youtubeId,
    speakers: [],
    event: "Test",
    durationSeconds,
    tier,
    teaser: "",
    after,
  };
}

const field: SkillField = {
  slug: "red-team",
  name: "Red Team",
  blurb: "",
  track: "red-team",
  branches: [
    { name: "Web", talks: [talk("a1", "beginner"), talk("a2", "intermediate"), talk("a3", "expert")] },
    { name: "Windows", talks: [talk("b2", "intermediate", 1800, ["a1"]), talk("b3", "advanced")] },
  ],
};

test("parents come from the nearest lower tier plus after links", () => {
  const layout = layoutField(field);
  assert.deepEqual(layout.byYoutubeId.get("a1")!.parents, []);
  assert.deepEqual(layout.byYoutubeId.get("a3")!.parents, ["a2"]);
  assert.deepEqual(layout.byYoutubeId.get("b2")!.parents, ["a1"]);
  assert.deepEqual(layout.byYoutubeId.get("b3")!.parents, ["b2"]);
});

test("tiers are columns, left to right", () => {
  const layout = layoutField(field);
  const x = (id: string) => layout.byYoutubeId.get(id)!.x;
  assert.ok(x("a1") < x("a2") && x("a2") < x("b3") && x("b3") < x("a3"));
  assert.equal(x("a2"), x("b2"));
});

test("cards in one tier stack without overlapping, and lanes do not overlap", () => {
  const stacked: SkillField = {
    ...field,
    branches: [
      { name: "Web", talks: [talk("c1", "beginner"), talk("c2", "beginner"), talk("c3", "intermediate")] },
      { name: "Windows", talks: [talk("d1", "beginner")] },
    ],
  };
  const layout = layoutField(stacked);
  const get = (id: string) => layout.byYoutubeId.get(id)!;
  assert.ok(get("c2").y - get("c1").y >= 64);
  const [web, win] = layout.branches;
  assert.ok(win.y >= web.y + web.height);
  assert.deepEqual(get("c3").parents.sort(), ["c1", "c2"]);
  for (const t of layout.talks) assert.ok(t.y >= 0 && t.y + 64 <= layout.height);
});

test("watching a talk unlocks the talks it feeds", () => {
  const layout = layoutField(field);
  const get = (id: string) => layout.byYoutubeId.get(id)!;
  const none = new Set<string>();
  assert.equal(talkStatus(get("a1"), layout, none), "ready");
  assert.equal(talkStatus(get("b2"), layout, none), "locked");
  // A watched id from another archive copy of the same video still counts.
  const watched = new Set(["other-file-a1"]);
  assert.equal(talkStatus(get("a1"), layout, watched), "watched");
  assert.equal(talkStatus(get("b2"), layout, watched), "ready");
  assert.equal(talkStatus(get("a2"), layout, watched), "ready");
  assert.equal(talkStatus(get("b3"), layout, watched), "locked");
});

test("rank follows watched time", () => {
  const layout = layoutField(field);
  assert.equal(rankFor(layout, new Set()).rank.name, "Operator");
  const all = new Set(layout.talks.map((t) => t.id));
  const r = rankFor(layout, all);
  assert.equal(r.watchedSeconds, 5 * 1800);
  assert.equal(r.rank.name, "Operator");
  assert.equal(r.next?.name, "Specialist");
  assert.equal(hoursMinutes(r.watchedSeconds), "2h 30m");
  assert.equal(hoursMinutes(4 * 3600 + 59), "4h 01m");
});
