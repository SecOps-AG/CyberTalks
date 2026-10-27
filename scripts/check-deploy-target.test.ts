import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertDeployTarget, PLACEHOLDER_DATABASE_ID, type DeployConfig } from "./check-deploy-target";
import { parseJsonc } from "./d1/jsonc";

const PROD_ID = "11111111-1111-4111-8111-111111111111";

function config(overrides: DeployConfig = {}): DeployConfig {
  return {
    name: "cybertalks-d1",
    services: [{ service: "cybertalks-d1" }],
    d1_databases: [
      { binding: "TALKS_DB", database_name: "cybertalks-d1-prod", database_id: PROD_ID },
    ],
    routes: [{ pattern: "cybertalks.org" }, { pattern: "www.cybertalks.org" }],
    ...overrides,
  };
}

test("accepts the live worker and the production database", () => {
  assert.doesNotThrow(() => assertDeployTarget(config()));
});

test("rejects the legacy worker name, a service binding to it, and a placeholder id", () => {
  assert.throws(() => assertDeployTarget(config({ name: "cybertalks" })), /cybertalks-d1/);
  assert.throws(
    () => assertDeployTarget(config({ services: [{ service: "cybertalks" }] })),
    /legacy worker/,
  );
  assert.throws(
    () =>
      assertDeployTarget(
        config({
          d1_databases: [
            {
              binding: "TALKS_DB",
              database_name: "cybertalks-d1-prod",
              database_id: PLACEHOLDER_DATABASE_ID,
            },
          ],
        }),
      ),
    /placeholder/,
  );
  assert.throws(
    () =>
      assertDeployTarget(
        config({
          d1_databases: [
            { binding: "TALKS_DB", database_name: "cybertalks-d1-preview", database_id: PROD_ID },
          ],
        }),
      ),
    /cybertalks-d1-prod/,
  );
});

test("the default config is the live worker and the legacy file is not", () => {
  const live = parseJsonc(readFileSync("wrangler.jsonc", "utf8")) as DeployConfig;
  const legacy = parseJsonc(readFileSync("wrangler.legacy.jsonc", "utf8")) as DeployConfig;
  assert.equal(live.name, "cybertalks-d1");
  assert.equal(live.d1_databases?.[0]?.database_name, "cybertalks-d1-prod");
  assert.equal(legacy.name, "cybertalks");
  assert.equal(legacy.d1_databases, undefined);
  assert.throws(() => assertDeployTarget(legacy), /cybertalks-d1/);
  try {
    assertDeployTarget(live);
    assert.notEqual(live.d1_databases?.[0]?.database_id, PLACEHOLDER_DATABASE_ID);
  } catch (error) {
    assert.match(String(error), /placeholder|database_id/);
  }
});
