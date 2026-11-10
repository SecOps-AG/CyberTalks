import assert from "node:assert/strict";
import { describe, it } from "node:test";
import merges from "../../data/topic-merges.json";
import taxonomy from "../../data/taxonomy.json";
import { canonicalTopicSlug, mergeTopics, topicRedirectPath } from "./topic-merges";

const map = merges.merges as Record<string, string>;

describe("topic merge map", () => {
  it("is flat: no variant points at another variant, and none at itself", () => {
    for (const [variant, canonical] of Object.entries(map)) {
      assert.notEqual(variant, canonical);
      assert.equal(canonical in map, false, `${variant} -> ${canonical} is a chain`);
    }
  });

  it("does not collide with the taxonomy aliases", () => {
    const aliases = (taxonomy.topicAliases ?? {}) as Record<string, string>;
    for (const target of Object.values(aliases)) {
      assert.equal(target in map, false, `alias target ${target} is merged away`);
    }
    for (const alias of Object.keys(aliases)) {
      assert.equal(alias in map, false, `${alias} is both an alias and a merge variant`);
    }
  });

  it("lists every merge in the reviewable groups, once", () => {
    const fromGroups = new Map<string, string>();
    for (const group of merges.groups) {
      for (const variant of group.variants) {
        assert.equal(fromGroups.has(variant.topic), false, variant.topic);
        fromGroups.set(variant.topic, group.canonical);
      }
    }
    assert.deepEqual(Object.fromEntries([...fromGroups].sort()), Object.fromEntries(Object.entries(map).sort()));
  });

  it("maps the known spelling variants", () => {
    const expected: Record<string, string> = {
      kubernete: "kubernetes",
      analysi: "analysis",
      devop: "devops",
      vulnerabilitie: "vulnerabilities",
      lockpicking: "lock-picking",
      wifi: "wi-fi",
      "0day": "0-day",
      defcon: "def-con",
      "red-teaming": "red-team",
      "4developer": "4developers",
      window: "windows",
      threats: "threat",
      interviews: "interview",
    };
    for (const [variant, canonical] of Object.entries(expected)) {
      assert.equal(canonicalTopicSlug(variant), canonical, variant);
    }
  });

  it("keeps distinct concepts apart", () => {
    for (const topic of ["http", "https", "arm", "arms", "day", "days", "lock", "locks", "adam", "adams", "ai", "kubernetes"]) {
      assert.equal(canonicalTopicSlug(topic), topic, topic);
    }
  });

  it("does not read inherited object keys", () => {
    assert.equal(canonicalTopicSlug("constructor"), "constructor");
    assert.equal(topicRedirectPath("/topics/constructor", ""), null);
    assert.equal(topicRedirectPath("/topics/__proto__", ""), null);
  });
});

describe("mergeTopics", () => {
  it("counts a variant as its canonical topic and drops repeats", () => {
    assert.deepEqual(mergeTopics(["wifi", "kubernete", "wi-fi", "kubernetes", "ics"]), ["wi-fi", "kubernetes", "ics"]);
  });
  it("runs the taxonomy alias first", () => {
    assert.deepEqual(mergeTopics(["iot-security", "iot"], (topic) => (topic === "iot-security" ? "iot" : topic)), ["iot"]);
  });
});

describe("topic redirects", () => {
  it("301 targets keep the query and tolerate a trailing slash", () => {
    assert.equal(topicRedirectPath("/topics/kubernete", ""), "/topics/kubernetes");
    assert.equal(topicRedirectPath("/topics/lockpicking", ""), "/topics/lock-picking");
    assert.equal(topicRedirectPath("/topics/wifi/", "?year=2024"), "/topics/wi-fi?year=2024");
    assert.equal(topicRedirectPath("/topics/%30day", ""), "/topics/0-day");
  });
  it("leaves canonical topics, the index, and other routes alone", () => {
    assert.equal(topicRedirectPath("/topics/kubernetes", ""), null);
    assert.equal(topicRedirectPath("/topics", ""), null);
    assert.equal(topicRedirectPath("/topics/kubernete/extra", ""), null);
    assert.equal(topicRedirectPath("/talks/kubernete", ""), null);
    assert.equal(topicRedirectPath("/topics/%E0%A4%A", ""), null);
  });
});
