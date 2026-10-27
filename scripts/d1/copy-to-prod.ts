/**
 * Copy cybertalks-d1-preview into cybertalks-d1-prod.
 *
 * Reads the preview database. Writes only a database named cybertalks-d1-prod.
 * Does not deploy, delete, or modify the cybertalks worker.
 * Does not run SQL that changes the preview database.
 * A matching production database is left in place.
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = "46d1c096a70866c4b05e8842743afd6e";
const PREVIEW_DB = "cybertalks-d1-preview";
const PROD_DB = "cybertalks-d1-prod";
const LIVE_WORKER = "cybertalks-d1";
const LEGACY_WORKER = "cybertalks";
const SYNC_WORKER = "cybertalks-d1-sync";

type DbRow = { uuid: string; name: string };
type CountMap = Record<string, number>;

export function diffCounts(preview: CountMap, prod: CountMap): string[] {
  const keys = [...new Set([...Object.keys(preview), ...Object.keys(prod)])].sort();
  const errors: string[] = [];
  for (const key of keys) {
    if (preview[key] !== prod[key]) {
      errors.push(`${key} preview ${preview[key] ?? "missing"} prod ${prod[key] ?? "missing"}`);
    }
  }
  return errors;
}

function redact(text: string): string {
  let out = text.replace(/https?:\/\/\S+/g, "[url]");
  for (const name of ["CLOUDFLARE_API_TOKEN", "D1_DATABASE_ID"]) {
    const value = process.env[name];
    if (value && value.length > 6) out = out.split(value).join("[redacted]");
  }
  return out;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function cf(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: unknown;
    result_info?: { page?: number; total_pages?: number };
  };
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(
      `${init?.method ?? "GET"} ${path} failed (${response.status})${message ? `: ${redact(message)}` : ""}`,
    );
  }
  return payload as Record<string, unknown>;
}

function assertSelect(sql: string): void {
  const trimmed = sql.trim();
  if (!/^select\b/i.test(trimmed)) throw new Error("Only SELECT statements are sent to D1.");
  if (/\b(insert|update|delete|drop|alter|create|replace|attach|pragma)\b/i.test(trimmed)) {
    throw new Error("Refusing a statement that would change a database.");
  }
}

async function query(
  token: string,
  databaseId: string,
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  assertSelect(sql);
  const payload = await cf(token, `/accounts/${ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: "POST",
    body: { sql, params },
  });
  const result = payload.result as { results?: Record<string, unknown>[] }[] | undefined;
  return result?.[0]?.results ?? [];
}

function num(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, got ${String(value)}.`);
  return parsed;
}

async function listDatabases(token: string): Promise<DbRow[]> {
  const rows: DbRow[] = [];
  for (let page = 1; page < 20; page += 1) {
    const payload = await cf(token, `/accounts/${ACCOUNT_ID}/d1/database?per_page=100&page=${page}`);
    const result = payload.result as { uuid?: string; name?: string }[] | undefined;
    if (!Array.isArray(result) || result.length === 0) break;
    for (const row of result) {
      if (row.uuid && row.name) rows.push({ uuid: row.uuid, name: row.name });
    }
    const info = payload.result_info as { total_pages?: number } | undefined;
    if (!info?.total_pages || page >= info.total_pages) break;
  }
  return rows;
}

function findDb(rows: DbRow[], name: string): DbRow | null {
  const matches = rows.filter((row) => row.name === name);
  if (matches.length > 1) throw new Error(`More than one D1 database is named ${name}.`);
  return matches[0] ?? null;
}

async function tableNames(token: string, databaseId: string): Promise<string[]> {
  try {
    const rows = await query(
      token,
      databaseId,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    return rows
      .map((row) => String(row.name ?? ""))
      .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      .filter((name) => !name.startsWith("sqlite_") && !name.startsWith("_cf_"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table|not found/i.test(message)) return [];
    throw error;
  }
}

async function measure(token: string, databaseId: string): Promise<CountMap> {
  const names = await tableNames(token, databaseId);
  const counts: CountMap = {};
  for (const name of names) {
    const rows = await query(token, databaseId, `SELECT COUNT(*) AS n FROM ${name}`);
    counts[`count.${name}`] = num(rows[0]?.n ?? 0);
  }
  if (!names.includes("talks")) {
    counts["count.talks"] = 0;
    return counts;
  }
  const sums = await query(
    token,
    databaseId,
    `SELECT
       COALESCE(SUM(LENGTH(body)), 0) AS body_bytes,
       COALESCE(SUM(LENGTH(index_json)), 0) AS index_bytes,
       COALESCE(SUM(LENGTH(related_ids)), 0) AS related_bytes,
       COALESCE(SUM(LENGTH(summary_text)), 0) AS summary_bytes,
       COUNT(summary_text) AS summaries
     FROM talks`,
  );
  const row = sums[0] ?? {};
  counts["bytes.body"] = num(row.body_bytes ?? 0);
  counts["bytes.index_json"] = num(row.index_bytes ?? 0);
  counts["bytes.related_ids"] = num(row.related_bytes ?? 0);
  counts["bytes.summary_text"] = num(row.summary_bytes ?? 0);
  counts["count.summaries"] = num(row.summaries ?? 0);
  const total = counts["count.talks"] ?? 0;
  const offsets = [0, Math.floor(total / 2), Math.max(0, total - 1)];
  for (const offset of total === 0 ? [] : [...new Set(offsets)]) {
    const sample = await query(
      token,
      databaseId,
      "SELECT id, slug, content_hash, LENGTH(body) AS body_len FROM talks ORDER BY id LIMIT 1 OFFSET ?",
      [offset],
    );
    const item = sample[0];
    if (!item) continue;
    counts[`sample.${offset}.body_len`] = num(item.body_len ?? 0);
    counts[`sample.${offset}.hash`] = hashString(String(item.content_hash ?? ""));
    counts[`sample.${offset}.slug`] = hashString(String(item.slug ?? ""));
    counts[`sample.${offset}.id`] = hashString(String(item.id ?? ""));
  }
  return counts;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export function assertWranglerArgs(args: string[]): void {
  for (const arg of args) {
    if (arg === LEGACY_WORKER || arg === "wrangler.legacy.jsonc" || arg === "wrangler.jsonc") {
      throw new Error(`Refusing wrangler argument ${arg}.`);
    }
    if (arg === "deploy" || arg === "delete" || arg === "rollback" || arg === "--preview") {
      throw new Error(`Refusing wrangler argument ${arg}.`);
    }
  }
  if (args[0] === "d1" && args[1] === "export" && args[2] !== PREVIEW_DB) {
    throw new Error("Export source must be cybertalks-d1-preview.");
  }
  if (args[0] === "d1" && args[1] === "execute" && args[2] !== PROD_DB) {
    throw new Error("Execute target must be cybertalks-d1-prod.");
  }
  if (args.includes("execute") && !args.includes("--remote")) {
    throw new Error("Execute must target the remote database.");
  }
  if (args.includes("export") && !args.includes("--remote")) {
    throw new Error("Export must read the remote database.");
  }
}

function runWrangler(args: string[], configPath: string): Promise<void> {
  assertWranglerArgs(args);
  const bin = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args, "--config", configPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const onData = (chunk: Buffer) => process.stdout.write(redact(chunk.toString("utf8")));
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler ${args.slice(0, 3).join(" ")} exited ${code ?? "unknown"}.`));
    });
  });
}

async function writeSyncConfig(dir: string): Promise<string> {
  const configPath = join(dir, "wrangler.jsonc");
  await writeFile(
    configPath,
    JSON.stringify(
      {
        name: SYNC_WORKER,
        account_id: ACCOUNT_ID,
        compatibility_date: "2026-10-04",
        workers_dev: false,
      },
      null,
      2,
    ),
  );
  return configPath;
}

function bindingSummary(binding: Record<string, unknown>): string {
  const type = String(binding.type ?? "");
  const name = String(binding.name ?? "");
  if (type === "secret_text" || type === "secret_key") return `type=${type} name=${name} present=true`;
  const parts = [`type=${type}`, `name=${name}`];
  for (const key of ["id", "database_id", "bucket_name", "service", "namespace_id"]) {
    if (binding[key] != null) parts.push(`${key}=${String(binding[key])}`);
  }
  if (type === "plain_text") parts.push(`length=${String(binding.text ?? "").length}`);
  return parts.join(" ");
}

async function inspectWorkers(token: string, previewId: string): Promise<void> {
  const calls: [string, string][] = [
    ["scripts", `/accounts/${ACCOUNT_ID}/workers/scripts`],
    ["domains", `/accounts/${ACCOUNT_ID}/workers/domains`],
    ["live-settings", `/accounts/${ACCOUNT_ID}/workers/scripts/${LIVE_WORKER}/settings`],
    ["live-deployments", `/accounts/${ACCOUNT_ID}/workers/scripts/${LIVE_WORKER}/deployments`],
    ["legacy-settings", `/accounts/${ACCOUNT_ID}/workers/scripts/${LEGACY_WORKER}/settings`],
    ["legacy-deployments", `/accounts/${ACCOUNT_ID}/workers/scripts/${LEGACY_WORKER}/deployments`],
  ];
  for (const [label, path] of calls) {
    try {
      const payload = await cf(token, path);
      if (label === "scripts") {
        const result = payload.result as { id?: string }[] | undefined;
        const names = Array.isArray(result) ? result.map((item) => item.id).filter(Boolean) : [];
        console.log(`INSPECT scripts ${names.join(",")}`);
        continue;
      }
      if (label === "domains") {
        const result = payload.result as { hostname?: string; service?: string }[] | undefined;
        for (const domain of result ?? []) {
          if (!domain.hostname?.includes("cybertalks.org")) continue;
          console.log(`INSPECT domain hostname=${domain.hostname} service=${domain.service ?? ""}`);
        }
        continue;
      }
      if (label.endsWith("settings")) {
        const result = (payload.result ?? {}) as {
          compatibility_date?: string;
          compatibility_flags?: string[];
          bindings?: Record<string, unknown>[];
        };
        console.log(
          `INSPECT ${label} compatibility_date=${result.compatibility_date ?? ""} flags=${(result.compatibility_flags ?? []).join(",")}`,
        );
        for (const binding of result.bindings ?? []) {
          const line = bindingSummary(binding);
          console.log(`INSPECT ${label} binding ${line}`);
          if (label === "live-settings" && String(binding.name) === "TALKS_DB") {
            const id = String(binding.id ?? binding.database_id ?? "");
            console.log(`INSPECT talks_db_is_preview=${id !== "" && id === previewId}`);
          }
        }
        continue;
      }
      const result = payload.result as {
        deployments?: { id?: string; created_on?: string; versions?: { version_id?: string }[] }[];
      };
      const latest = result.deployments?.[0];
      const version = latest?.versions?.[0]?.version_id ?? latest?.id ?? "";
      console.log(`INSPECT ${label} version=${version} created=${latest?.created_on ?? ""}`);
    } catch (error) {
      console.log(`INSPECT_ERROR ${label} ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function createProd(token: string): Promise<DbRow> {
  const payload = await cf(token, `/accounts/${ACCOUNT_ID}/d1/database`, {
    method: "POST",
    body: { name: PROD_DB, primary_location_hint: "wnam" },
  });
  const result = payload.result as { uuid?: string; name?: string };
  if (result.name !== PROD_DB || !result.uuid) {
    throw new Error("Create returned an unexpected database.");
  }
  return { uuid: result.uuid, name: result.name };
}

async function main(): Promise<void> {
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  if (account !== ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID does not match the repo account.");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");

  const databases = await listDatabases(token);
  const preview = findDb(databases, PREVIEW_DB);
  if (!preview) throw new Error(`Database ${PREVIEW_DB} was not found.`);
  const secretId = process.env.D1_DATABASE_ID?.trim() ?? "";
  if (secretId && secretId !== preview.uuid) {
    throw new Error(`D1_DATABASE_ID does not match the database named ${PREVIEW_DB}.`);
  }
  console.log(`preview database ${PREVIEW_DB} found secret_match=${secretId === preview.uuid}`);

  await inspectWorkers(token, preview.uuid);

  let prod = findDb(databases, PROD_DB);
  if (!prod) {
    prod = await createProd(token);
    console.log(`created database ${PROD_DB} id=${prod.uuid}`);
  } else {
    console.log(`database ${PROD_DB} already exists id=${prod.uuid}`);
  }
  if (prod.uuid === preview.uuid) throw new Error("Preview and production database ids are the same.");

  const previewCounts = await measure(token, preview.uuid);
  console.log(`preview talks ${previewCounts["count.talks"] ?? 0}`);
  let prodCounts = await measure(token, prod.uuid);
  const before = diffCounts(previewCounts, prodCounts);
  if (before.length === 0 && (previewCounts["count.talks"] ?? 0) > 0) {
    console.log(`COPY_REPORT ${JSON.stringify({ match: true, copied: false, prod_database_id: prod.uuid, counts: previewCounts })}`);
    return;
  }
  if ((prodCounts["count.talks"] ?? 0) > 0) {
    throw new Error(`Refusing to overwrite ${PROD_DB}: ${before.join("; ")}`);
  }

  const dir = await mkdtemp(join(tmpdir(), "cybertalks-d1-copy-"));
  const sqlPath = join(dir, "preview.sql");
  try {
    const configPath = await writeSyncConfig(dir);
    console.log(`exporting ${PREVIEW_DB}`);
    await runWrangler(["d1", "export", PREVIEW_DB, "--remote", "-y", "--output", sqlPath], configPath);
    console.log(`importing into ${PROD_DB}`);
    await runWrangler(["d1", "execute", PROD_DB, "--remote", "--yes", "--file", sqlPath], configPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  prodCounts = await measure(token, prod.uuid);
  const after = diffCounts(previewCounts, prodCounts);
  console.log(`COPY_REPORT ${JSON.stringify({ match: after.length === 0, copied: true, prod_database_id: prod.uuid, counts: previewCounts, prod: prodCounts, diff: after })}`);
  if (after.length > 0) throw new Error(`Row counts differ after copy: ${after.join("; ")}`);
}

if (process.argv[1]?.endsWith("copy-to-prod.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
