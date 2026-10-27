/**
 * npm run deploy and npm run upload run this first.
 * The default config must name the live worker and the production database.
 * The previous worker is only described in wrangler.legacy.jsonc.
 */
import { readFileSync } from "node:fs";
import { parseJsonc } from "./d1/jsonc";

export const PLACEHOLDER_DATABASE_ID = "00000000-0000-0000-0000-0000000000d1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeployConfig = {
  name?: string;
  services?: { service?: string }[];
  d1_databases?: { binding?: string; database_name?: string; database_id?: string }[];
  routes?: { pattern?: string }[];
};

export function assertDeployTarget(config: DeployConfig): void {
  if (config.name !== "cybertalks-d1") {
    throw new Error(
      `Deploy config names "${config.name ?? ""}". The only worker npm run deploy may upload is cybertalks-d1.`,
    );
  }
  for (const service of config.services ?? []) {
    if (service.service === "cybertalks") {
      throw new Error("Deploy config references the legacy worker cybertalks.");
    }
  }
  const db = (config.d1_databases ?? []).find((item) => item.binding === "TALKS_DB");
  if (!db) throw new Error("Deploy config is missing the TALKS_DB binding.");
  if (db.database_name !== "cybertalks-d1-prod") {
    throw new Error(`TALKS_DB names "${db.database_name ?? ""}". Expected cybertalks-d1-prod.`);
  }
  if (!db.database_id || db.database_id === PLACEHOLDER_DATABASE_ID || !UUID.test(db.database_id)) {
    throw new Error("TALKS_DB database_id is missing or still a placeholder.");
  }
  const patterns = new Set((config.routes ?? []).map((route) => route.pattern));
  for (const pattern of ["cybertalks.org", "www.cybertalks.org"]) {
    if (!patterns.has(pattern)) throw new Error(`Deploy config is missing the ${pattern} route.`);
  }
}

function main(): void {
  const text = readFileSync("wrangler.jsonc", "utf8");
  const config = parseJsonc(text) as DeployConfig;
  assertDeployTarget(config);
  console.log(`deploy target ${config.name} database cybertalks-d1-prod`);
}

if (process.argv[1]?.endsWith("check-deploy-target.ts")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
