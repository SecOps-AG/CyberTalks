import type { SortKey } from "./search";

/**
 * The homepage paints from the first page already in the HTML. The full talk
 * index (every year shard) is only needed once the visible page cannot be
 * answered from that slice: a query, a filter, another page, or a new sort.
 */
export function homepageNeedsFullIndex(input: {
  query: string;
  page: number;
  sort: SortKey | string;
  /** `countActive` with the query cleared, so page and sort are not counted twice. */
  activeFilters: number;
}): boolean {
  return (
    input.query.trim().length > 0 ||
    input.page > 1 ||
    input.sort !== "relevance" ||
    input.activeFilters > 0
  );
}

export type TalkGridPhase = "frozen" | "waiting" | "partial" | "ready" | "error";

/**
 * What the homepage card grid shows while the year shards load.
 * The frozen first page holds only while nobody has asked for a different view.
 * A query or filter shows the first batch that lands, then the rest as they arrive.
 */
export function talkGridPhase(input: {
  defer: boolean;
  viewNeedsIndex: boolean;
  indexReady: boolean;
  batchApplied: boolean;
  failed: boolean;
}): TalkGridPhase {
  if (input.failed && input.viewNeedsIndex) return "error";
  if (input.defer && !input.viewNeedsIndex) return "frozen";
  if (input.viewNeedsIndex && !input.indexReady && !input.batchApplied) return "waiting";
  if (input.viewNeedsIndex && !input.indexReady) return "partial";
  return "ready";
}

/**
 * The year shards download when the view needs them, or when a phone filter
 * is staged. Focusing the search box or scrolling the filter drawer does not.
 * Saved-talk pages are not deferred, so they still load on mount.
 */
export function shouldFetchTalkIndex(input: {
  remote: boolean;
  defer: boolean;
  viewNeedsIndex: boolean;
  stagedNeedsIndex: boolean;
}): boolean {
  if (!input.remote) return false;
  if (!input.defer) return true;
  return input.viewNeedsIndex || input.stagedNeedsIndex;
}

/**
 * The "/ N" after the result count is the whole catalog, extras included.
 * Before the full index loads, the browser only holds the first page the
 * server sent, so it must use the server's catalog size, not that page's length.
 */
export function catalogUniverse(input: {
  catalogSize: number | undefined;
  loadedTalks: number;
  indexPending: boolean;
}): number {
  return input.catalogSize != null && input.indexPending ? input.catalogSize : input.loadedTalks;
}
