/**
 * The compact search index, stored in D1 so a sync can refresh search
 * without uploading the worker again.
 *
 * Chunks stay under the SQL statement size limit. The sha is written last.
 * A reader that sees a sha that does not match the bytes falls back.
 */

import type { SqlClient } from "./sql";

/** Raw bytes per chunk, before base64. Keeps one INSERT under 100 KB. */
export const SEARCH_CHUNK_BYTES = 48 * 1024;

export function chooseSearchSource(
  d1Talks: number | null,
  assetTalks: number | null,
): "d1" | "assets" {
  if (d1Talks == null) return "assets";
  if (assetTalks == null) return "d1";
  return d1Talks >= assetTalks ? "d1" : "assets";
}

export function encodeSearchChunks(bytes: Uint8Array): string[] {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += SEARCH_CHUNK_BYTES) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + SEARCH_CHUNK_BYTES));
    let binary = "";
    const step = 0x8000;
    for (let index = 0; index < slice.length; index += step) {
      binary += String.fromCharCode(...slice.subarray(index, index + step));
    }
    parts.push(btoa(binary));
  }
  return parts;
}

export function decodeSearchChunks(parts: readonly string[]): Uint8Array {
  const buffers = parts.map((part) => {
    const binary = atob(part);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  });
  let total = 0;
  for (const bytes of buffers) total += bytes.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const bytes of buffers) {
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readStoredSearchIndex(
  db: SqlClient,
): Promise<{ bytes: Uint8Array; talks: number; sha: string } | null> {
  const meta = await db.all<{ key: string; value: string }>(
    "SELECT key, value FROM meta WHERE key IN ('search_index_sha', 'search_index_talks')",
  );
  const sha = meta.find((row) => row.key === "search_index_sha")?.value ?? "";
  const talks = Number(meta.find((row) => row.key === "search_index_talks")?.value);
  if (!sha || !Number.isFinite(talks)) return null;

  const parts: string[] = [];
  let seq = 0;
  for (;;) {
    const rows = await db.all<{ seq: number; data: string }>(
      "SELECT seq, data FROM search_index_chunk WHERE seq >= ? ORDER BY seq LIMIT 8",
      [seq],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      if (Number(row.seq) !== seq || typeof row.data !== "string") return null;
      parts.push(row.data);
      seq += 1;
    }
    if (rows.length < 8) break;
  }
  if (parts.length === 0) return null;
  const bytes = decodeSearchChunks(parts);
  const actual = await sha256Hex(bytes);
  if (actual !== sha) return null;
  return { bytes, talks, sha };
}

export function searchIndexStatements(
  parts: readonly string[],
  sha: string,
  talks: number,
  metaJson: string,
): { sql: string; params: unknown[] }[] {
  const statements: { sql: string; params: unknown[] }[] = parts.map((data, seq) => ({
    sql: `INSERT INTO search_index_chunk (seq, data) VALUES (?, ?)
      ON CONFLICT(seq) DO UPDATE SET data = excluded.data`,
    params: [seq, data],
  }));
  statements.push(
    { sql: "DELETE FROM search_index_chunk WHERE seq >= ?", params: [parts.length] },
    {
      sql: "INSERT INTO meta (key, value) VALUES ('search_index_sha', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params: [sha],
    },
    {
      sql: "INSERT INTO meta (key, value) VALUES ('search_index_talks', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params: [String(talks)],
    },
    {
      sql: "INSERT INTO meta (key, value) VALUES ('search_index_meta', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params: [metaJson],
    },
  );
  return statements;
}
