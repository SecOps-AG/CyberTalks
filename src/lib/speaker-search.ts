/** Page size for the speakers directory search. Matches the on-page list. */
export const SPEAKER_SEARCH_PAGE_SIZE = 100;
export const SPEAKER_SEARCH_MIN_QUERY = 2;

export type SpeakerHit = {
  name: string;
  slug: string;
  talkCount: number;
};

export type SpeakerSearchPage = {
  total: number;
  page: number;
  pageSize: number;
  speakers: SpeakerHit[];
};

/**
 * One page of name matches. The directory is search-first, so the browser
 * asks for the current query and page instead of the whole index.
 */
export function searchSpeakerHits(
  people: readonly SpeakerHit[],
  query: string,
  page: number,
  pageSize = SPEAKER_SEARCH_PAGE_SIZE,
): SpeakerSearchPage {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : SPEAKER_SEARCH_PAGE_SIZE;
  const needle = query.trim().toLowerCase();
  if (needle.length < SPEAKER_SEARCH_MIN_QUERY) {
    return { total: 0, page: 1, pageSize: size, speakers: [] };
  }

  const matching = people
    .filter((speaker) => speaker.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
  const totalPages = Math.max(1, Math.ceil(matching.length / size));
  const current = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), totalPages);
  const start = (current - 1) * size;
  return {
    total: matching.length,
    page: current,
    pageSize: size,
    speakers: matching.slice(start, start + size),
  };
}
