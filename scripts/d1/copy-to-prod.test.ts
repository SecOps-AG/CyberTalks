import assert from "node:assert/strict";
import test from "node:test";
import { assertWranglerArgs, diffCounts } from "./copy-to-prod";

test("wrangler args cannot target the legacy worker or deploy", () => {
  assert.throws(() => assertWranglerArgs(["deploy"]), /Refusing/);
  assert.throws(() => assertWranglerArgs(["d1", "execute", "cybertalks", "--remote"]), /Refusing/);
  assert.throws(
    () => assertWranglerArgs(["d1", "execute", "cybertalks-d1-preview", "--remote"]),
    /cybertalks-d1-prod/,
  );
  assert.throws(() => assertWranglerArgs(["d1", "export", "cybertalks-d1-preview", "--preview"]), /Refusing/);
  assert.doesNotThrow(() =>
    assertWranglerArgs(["d1", "export", "cybertalks-d1-preview", "--remote", "-y", "--output", "out.sql"]),
  );
  assert.doesNotThrow(() =>
    assertWranglerArgs(["d1", "execute", "cybertalks-d1-prod", "--remote", "--yes", "--file", "out.sql"]),
  );
});

test("count diff is empty only when every key matches", () => {
  assert.deepEqual(diffCounts({ "count.talks": 3, "bytes.body": 10 }, { "count.talks": 3, "bytes.body": 10 }), []);
  assert.deepEqual(diffCounts({ "count.talks": 3 }, { "count.talks": 2 }), [
    "count.talks preview 3 prod 2",
  ]);
  assert.deepEqual(diffCounts({ "count.talks": 3 }, {}), ["count.talks preview 3 prod missing"]);
});
