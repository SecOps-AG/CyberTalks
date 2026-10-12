/**
 * Precompute the JSON each prerendered route needs, so a Worker cache miss
 * never opens data/villages.
 *
 *   public/catalog/pages/...
 *   src/generated/page-routes.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCoverageByVillage,
  getCoverageForEvent,
  getDefconEditions,
  getDefconVillages,
  getEdition,
  getEditions,
  getEditionsForEvent,
  getEvents,
  getSeries,
  getSpeakers,
  getTalkIndex,
  getTalks,
  getTalksForEdition,
  getTalksForSeries,
  getTalksForTrack,
  getTrackCounts,
  getTracks,
  getStats,
  getConferenceCounts,
  getMostWatched,
  getTopicCounts,
} from "../src/lib/data";
import { HUBS, inDefconVillage } from "../src/lib/hubs";
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
} from "../src/lib/page-layout";
import type { HubPageData } from "../src/lib/page-runtime";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_LIMIT = 24 * 1024 * 1024;

function writeJson(pathname: string, value: unknown): number {
  const file = path.join(root, "public", pathname);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(value);
  if (json.length > ASSET_LIMIT) {
    throw new Error(`${pathname} is ${(json.length / 1024 / 1024).toFixed(1)} MB, over the 25 MB asset cap.`);
  }
  fs.writeFileSync(file, json);
  return json.length;
}

export function writePageShards(): string {
  const started = Date.now();
  let files = 0;
  let bytes = 0;
  let largest = 0;
  let largestName = "";

  const put = (pathname: string, value: unknown) => {
    const size = writeJson(pathname, value);
    files += 1;
    bytes += size;
    if (size > largest) {
      largest = size;
      largestName = pathname;
    }
  };

  const events = getEvents();
  const editions = getEditions();
  const talks = getTalks();
  const trackCounts = getTrackCounts();

  put(homePagePath, {
    stats: getStats(),
    conferences: getConferenceCounts(),
    mostWatched: getMostWatched(12),
    trackCounts,
  });
  put(tracksIndexPath, trackCounts);
  put(topicsIndexPath, getTopicCounts());
  put(speakersIndexPath, getSpeakers());
  put(villagesIndexPath, getDefconVillages());

  const villageCoverage = getCoverageByVillage();
  put(coveragePagePath, {
    events,
    editions,
    villageCoverage,
    eventStats: events.map((event) => ({
      event,
      stats: getCoverageForEvent(event.slug),
    })),
  });
  put(sitemapPagePath, {
    events,
    editions,
    villages: getDefconVillages(),
    tracks: getTracks(),
  });

  for (const { track } of trackCounts) {
    const pageTalks = getTalkIndex(getTalksForTrack(track.slug));
    if (pageTalks.length === 0) continue;
    put(trackPagePath(track.slug), { track, talks: pageTalks });
  }

  for (const event of events) {
    put(eventPagePath(event.slug), {
      event,
      editions: getEditionsForEvent(event.slug),
      talks: getTalkIndex(talks.filter((talk) => talk.eventSlug === event.slug)),
    });
  }

  for (const edition of editions) {
    const series = inDefconVillage(edition) ? getSeries(edition.villageSlug) ?? null : null;
    put(editionPagePath(edition.eventSlug, edition.villageSlug), {
      edition,
      series,
      talks: getTalkIndex(getTalksForEdition(edition.id)),
    });
  }

  for (const series of getDefconVillages()) {
    put(seriesPagePath(series.slug), {
      series,
      talks: getTalkIndex(getTalksForSeries(series.slug)),
    });
  }

  for (const hub of HUBS) {
    const payload: HubPageData = {
      talks: getTalkIndex(talks.filter((talk) => talk.conference === hub.conference)),
      editionCount: hub.id === "defcon" ? getDefconEditions().length : 0,
    };
    put(hubPagePath(hub.id), payload);
  }

  // Spot-check one edition against the loader's node shape.
  const sample = editions[0];
  if (sample) {
    const written = JSON.parse(
      fs.readFileSync(path.join(root, "public", editionPagePath(sample.eventSlug, sample.villageSlug)), "utf8"),
    ) as { edition: { id: string }; talks: { id: string }[] };
    const live = getEdition(sample.eventSlug, sample.villageSlug);
    const liveTalks = getTalkIndex(getTalksForEdition(sample.id));
    if (!live || written.edition.id !== live.id || written.talks.length !== liveTalks.length) {
      throw new Error(`Edition shard mismatch for ${sample.eventSlug}/${sample.villageSlug}`);
    }
    if (written.talks.some((talk, index) => talk.id !== liveTalks[index]?.id)) {
      throw new Error(`Edition talk order mismatch for ${sample.eventSlug}/${sample.villageSlug}`);
    }
  }

  const routes = {
    tracks: trackCounts.map(({ track }) => track.slug),
    events: events.map((event) => event.slug),
    editions: editions.map((edition) => ({
      event: edition.eventSlug,
      village: edition.villageSlug,
    })),
    series: getDefconVillages().map((series) => series.slug),
  };
  const routesFile = path.join(root, "src", "generated", "page-routes.json");
  fs.mkdirSync(path.dirname(routesFile), { recursive: true });
  fs.writeFileSync(routesFile, `${JSON.stringify(routes, null, 2)}\n`);

  return [
    `Pages ${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB), largest ${(largest / 1024).toFixed(0)} KB (${largestName}).`,
    `Routes: ${routes.tracks.length} tracks, ${routes.events.length} events, ${routes.editions.length} editions, ${routes.series.length} villages.`,
    `Page shards written in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
  ].join("\n");
}
