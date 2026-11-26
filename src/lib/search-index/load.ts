/**
 * Load the compact search index once per isolate.
 *
 * D1 is preferred when its copy has at least as many talks as the index built
 * into the worker. A sync can therefore publish new talks without a deploy.
 * A deploy that is ahead of the last sync keeps the index shipped with it.
 */

import { talksSql } from "../d1/binding";
import { chooseSearchSource, readStoredSearchIndex } from "../d1/search-store";
import type { SqlClient } from "../d1/sql";
import { readPublicBytes, readPublicJson } from "../catalog-runtime";
import { decodeSearchIndex, type RuntimeIndex } from "./decode";
import { SEARCH_INDEX_BIN, SEARCH_INDEX_META } from "./format";
import type { SearchMeta } from "./model";

export type SearchBundle = {
  index: RuntimeIndex;
  meta: SearchMeta;
};

let cached: { key: string; bundle: SearchBundle } | null = null;
let inflight: Promise<SearchBundle> | null = null;

async function readAssetBundle(): Promise<SearchBundle> {
  const [bytes, meta] = await Promise.all([
    readPublicBytes(SEARCH_INDEX_BIN),
    readPublicJson<SearchMeta>(SEARCH_INDEX_META),
  ]);
  if (!bytes || !meta) {
    throw new Error("Search index is missing. Rebuild so public/search-index is generated.");
  }
  if (meta.version !== 1) throw new Error(`Unsupported search meta version ${meta.version}.`);
  const index = decodeSearchIndex(bytes);
  if (index.docCount !== meta.talks) {
    throw new Error("Search index does not match its meta file.");
  }
  return { index, meta };
}

async function readD1Bundle(db: SqlClient): Promise<SearchBundle> {
  const [stored, metaRows] = await Promise.all([
    readStoredSearchIndex(db),
    db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'search_index_meta'"),
  ]);
  const raw = metaRows[0]?.value;
  if (!stored || !raw) throw new Error("D1 search index is missing or does not match its sha.");
  const meta = JSON.parse(raw) as SearchMeta;
  if (meta.version !== 1 || meta.talks !== stored.talks) {
    throw new Error("D1 search index meta does not match the stored bytes.");
  }
  const index = decodeSearchIndex(stored.bytes);
  if (index.docCount !== stored.talks) {
    throw new Error("D1 search index does not match its talk count.");
  }
  return { index, meta };
}

/**
 * A warm isolate re-checks which copy is current at most this often, so a
 * search does not wait on D1 before every answer. A sync shows up within a minute.
 */
const SOURCE_CHECK_MS = 60_000;
let checkedAt = 0;

async function resolveBundle(): Promise<SearchBundle> {
  if (cached && Date.now() - checkedAt < SOURCE_CHECK_MS) return cached.bundle;
  const db = await talksSql().catch(() => null);
  let source: "d1" | "assets" = "assets";
  let key = "assets";
  if (db) {
    try {
      const [metaRows, assetMeta] = await Promise.all([
        db.all<{ key: string; value: string }>(
          "SELECT key, value FROM meta WHERE key IN ('search_index_talks', 'search_index_sha')",
        ),
        readPublicJson<SearchMeta>(SEARCH_INDEX_META),
      ]);
      const value = (name: string) => metaRows.find((row) => row.key === name)?.value;
      const talksValue = value("search_index_talks");
      const d1Talks = talksValue != null ? Number(talksValue) : null;
      const count = d1Talks != null && Number.isFinite(d1Talks) ? d1Talks : null;
      source = chooseSearchSource(count, assetMeta?.talks ?? null);
      if (source === "d1") key = `d1:${value("search_index_sha") ?? ""}`;
    } catch (error) {
      console.error(error);
      source = "assets";
      key = "assets";
    }
  }
  checkedAt = Date.now();

  if (cached?.key === key) return cached.bundle;

  try {
    const bundle = source === "d1" && db ? await readD1Bundle(db) : await readAssetBundle();
    cached = { key, bundle };
    return bundle;
  } catch (error) {
    if (source !== "d1") throw error;
    console.error(error);
    const bundle = await readAssetBundle();
    cached = { key: "assets", bundle };
    return bundle;
  }
}

export function loadSearchBundle(): Promise<SearchBundle> {
  if (!inflight) {
    inflight = resolveBundle().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
