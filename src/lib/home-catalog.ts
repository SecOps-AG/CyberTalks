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
