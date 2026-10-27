/**
 * Load the prebuilt index once per isolate. The file is fetched from ASSETS on
 * Workers and from public/ during next dev and next start.
 */

import { readPublicBytes, readPublicJson } from "../catalog-runtime";
import { decodeSearchIndex, type RuntimeIndex } from "./decode";
import { SEARCH_INDEX_BIN, SEARCH_INDEX_META } from "./format";
import type { SearchMeta } from "./model";

export type SearchBundle = {
  index: RuntimeIndex;
  meta: SearchMeta;
};

let pending: Promise<SearchBundle> | null = null;

async function readBundle(): Promise<SearchBundle> {
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

export function loadSearchBundle(): Promise<SearchBundle> {
  if (!pending) {
    pending = readBundle().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
