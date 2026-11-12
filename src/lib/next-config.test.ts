import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfigForPhase from "../../next.config";

describe("redirects", () => {
  it("sends /talks to the home page permanently", async () => {
    const rules = await nextConfigForPhase("phase-test").redirects!();
    const talks = rules.find((rule) => rule.source === "/talks");
    assert.equal(talks?.destination, "/");
    assert.equal(talks?.permanent, true);
  });
});
