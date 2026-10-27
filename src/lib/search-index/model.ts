import type { Difficulty } from "../types";

export type Facet = {
  value: string;
  label: string;
  count: number;
};

export type YearFacet = {
  value: number;
  label: string;
  count: number;
};

export type SearchMeta = {
  version: 1;
  talks: number;
  sourceRecords: number;
  kinds: { talk: number; clip: number; interview: number; announcement: number };
  indexedKinds: ["talk"];
  years: YearFacet[];
  conferences: Facet[];
  tracks: Facet[];
  difficulties: Facet[];
  topicsTop: Facet[];
  topicTotal: number;
};

export type TalkHit = {
  id: string;
  slug: string;
  title: string;
  speakers: string[];
  year: number;
  conference: string;
  conferenceLabel: string;
  event: string;
  track: string;
  trackName: string;
  topics: string[];
  difficulty: Difficulty | null;
  url: string;
};

export type TalkDetail = TalkHit & {
  eventSlug: string;
  village: string;
  youtubeId: string;
  youtubeUrl: string;
};

export type SearchFacets = {
  years: YearFacet[];
  conferences: Facet[];
  tracks: Facet[];
  topics: Facet[];
  topicsTruncated: boolean;
  topicTotal: number;
  difficulties: Facet[];
};

export type SearchResponse = {
  query: {
    q: string;
    terms: string[];
    year: number[];
    conference: string[];
    track: string[];
    topic: string[];
    difficulty: Difficulty[];
    sort: "relevance" | "newest";
    page: number;
    pageSize: number;
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  results: TalkHit[];
  facets: SearchFacets;
};
