/**
 * Data for prerendered routes.
 *
 * On Workers each call reads one precomputed JSON file. A cache miss must not
 * fall through to data.ts, which opens every village file. On Node (next dev,
 * next build, Vercel) the same functions still call data.ts, so local edits
 * show up without a shard rebuild.
 */
import { cache } from "react";
import { onWorker, readPublicJson } from "./catalog-runtime";
import { HUBS, inDefconVillage } from "./hubs";
import {
  coveragePagePath,
  editionPagePath,
  eventPagePath,
  homePagePath,
  hubPagePath,
  seriesPagePath,
  sitemapPagePath,
  speakersIndexPath,
  topicsIndexPath,
  trackPagePath,
  tracksIndexPath,
  villagesIndexPath,
} from "./page-layout";
import type { CoverageStats, VillageCoverage } from "./data";
import type {
  ArchiveStats,
  ConEvent,
  Speaker,
  Talk,
  TalkIndexEntry,
  Track,
  VillageEdition,
  VillageSeries,
} from "./types";

export type HomePageData = {
  stats: ArchiveStats;
  conferences: { slug: string; label: string; count: number }[];
  mostWatched: Talk[];
  trackCounts: { track: Track; count: number }[];
};

export type TrackCount = { track: Track; count: number };
export type TopicCount = { topic: string; label: string; count: number };

export type TrackPageData = { track: Track; talks: TalkIndexEntry[] };
export type EventPageData = {
  event: ConEvent;
  editions: VillageEdition[];
  talks: TalkIndexEntry[];
};
export type EditionPageData = {
  edition: VillageEdition;
  series: VillageSeries | null;
  talks: TalkIndexEntry[];
};
export type SeriesPageData = { series: VillageSeries; talks: TalkIndexEntry[] };
export type HubPageData = { talks: TalkIndexEntry[]; editionCount: number };

export type CoveragePageData = {
  events: ConEvent[];
  editions: VillageEdition[];
  villageCoverage: VillageCoverage[];
  eventStats: { event: ConEvent; stats: CoverageStats }[];
};

export type SitemapPageData = {
  events: ConEvent[];
  editions: VillageEdition[];
  villages: VillageSeries[];
  tracks: Track[];
};

type Disk = typeof import("./data");

async function disk(): Promise<Disk> {
  return import("./data");
}

function workerPath(build: () => string): string | null {
  try {
    return build();
  } catch {
    return null;
  }
}

async function fromShard<T>(pathname: string | null, build: (data: Disk) => T | null): Promise<T | null> {
  if (onWorker()) {
    if (!pathname) return null;
    return readPublicJson<T>(pathname);
  }
  return build(await disk());
}

async function fromShardRequired<T>(pathname: string, build: (data: Disk) => T): Promise<T> {
  if (onWorker()) {
    const file = await readPublicJson<T>(pathname);
    if (!file) throw new Error(`Missing page shard ${pathname}`);
    return file;
  }
  return build(await disk());
}

export const loadHome = cache((): Promise<HomePageData> =>
  fromShardRequired(homePagePath, (data) => ({
    stats: data.getStats(),
    conferences: data.getConferenceCounts(),
    mostWatched: data.getMostWatched(12),
    trackCounts: data.getTrackCounts(),
  })),
);

export const loadTrackCounts = cache((): Promise<TrackCount[]> =>
  fromShardRequired(tracksIndexPath, (data) => data.getTrackCounts()),
);

export const loadTopicCounts = cache((): Promise<TopicCount[]> =>
  fromShardRequired(topicsIndexPath, (data) => data.getTopicCounts()),
);

export const loadSpeakers = cache((): Promise<Speaker[]> =>
  fromShardRequired(speakersIndexPath, (data) => data.getSpeakers()),
);

export const loadDefconVillages = cache((): Promise<VillageSeries[]> =>
  fromShardRequired(villagesIndexPath, (data) => data.getDefconVillages()),
);

export const loadCoverage = cache((): Promise<CoveragePageData> =>
  fromShardRequired(coveragePagePath, (data) => {
    const events = data.getEvents();
    return {
      events,
      editions: data.getEditions(),
      villageCoverage: data.getCoverageByVillage(),
      eventStats: events.map((event) => ({
        event,
        stats: data.getCoverageForEvent(event.slug),
      })),
    };
  }),
);

export const loadSitemapData = cache((): Promise<SitemapPageData> =>
  fromShardRequired(sitemapPagePath, (data) => ({
    events: data.getEvents(),
    editions: data.getEditions(),
    villages: data.getDefconVillages(),
    tracks: data.getTracks(),
  })),
);

export const loadTrackPage = cache(
  (slug: string): Promise<TrackPageData | null> =>
    fromShard(workerPath(() => trackPagePath(slug)), (data) => {
      const track = data.getTrack(slug);
      if (!track) return null;
      const talks = data.getTalkIndex(data.getTalksForTrack(track.slug));
      if (talks.length === 0) return null;
      return { track, talks };
    }),
);

export const loadEventPage = cache(
  (slug: string): Promise<EventPageData | null> =>
    fromShard(workerPath(() => eventPagePath(slug)), (data) => {
      const event = data.getEvent(slug);
      if (!event) return null;
      return {
        event,
        editions: data.getEditionsForEvent(event.slug),
        talks: data.getTalkIndex(data.getTalks().filter((talk) => talk.eventSlug === event.slug)),
      };
    }),
);

export const loadEditionPage = cache(
  (eventSlug: string, villageSlug: string): Promise<EditionPageData | null> =>
    fromShard(workerPath(() => editionPagePath(eventSlug, villageSlug)), (data) => {
      const edition = data.getEdition(eventSlug, villageSlug);
      if (!edition) return null;
      const series = inDefconVillage(edition) ? data.getSeries(edition.villageSlug) ?? null : null;
      return {
        edition,
        series,
        talks: data.getTalkIndex(data.getTalksForEdition(edition.id)),
      };
    }),
);

export const loadSeriesPage = cache(
  (slug: string): Promise<SeriesPageData | null> =>
    fromShard(workerPath(() => seriesPagePath(slug)), (data) => {
      const series = data.getSeries(slug);
      if (!series) return null;
      return { series, talks: data.getTalkIndex(data.getTalksForSeries(series.slug)) };
    }),
);

export const loadHubPage = cache(
  (id: "defcon" | "black-hat" | "bsides"): Promise<HubPageData> =>
    fromShardRequired(hubPagePath(id), (data) => {
      const hub = HUBS.find((item) => item.id === id);
      if (!hub) throw new Error(`Unknown hub ${id}`);
      return {
        talks: data.getTalkIndex(data.getTalks().filter((talk) => talk.conference === hub.conference)),
        editionCount: id === "defcon" ? data.getDefconEditions().length : 0,
      };
    }),
);
