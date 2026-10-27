import assert from "node:assert/strict";
import test from "node:test";
import { d1TargetFromConfig } from "./sync";

const PROD_ID = "22222222-2222-4222-8222-222222222222";

test("reads the production binding and refuses the legacy worker", () => {
  const text = `{
    "name": "cybertalks-d1",
    "d1_databases": [{
      "binding": "TALKS_DB",
      "database_name": "cybertalks-d1-prod",
      "database_id": "${PROD_ID}"
    }]
  }`;
  assert.deepEqual(d1TargetFromConfig(text), {
    databaseId: PROD_ID,
    databaseName: "cybertalks-d1-prod",
  });
  assert.throws(() => d1TargetFromConfig(`{ "name": "cybertalks" }`), /legacy worker/);
  assert.throws(
    () =>
      d1TargetFromConfig(`{
        "name": "cybertalks-d1",
        "d1_databases": [{
          "binding": "TALKS_DB",
          "database_name": "cybertalks-d1-prod",
          "database_id": "00000000-0000-0000-0000-0000000000d1"
        }]
      }`),
    /placeholder/,
  );
});
