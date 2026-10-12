/**
 * Conference hub IA — villages are DEF CON-only in facets, links, and sort.
 *
 * Non-DEF CON talks still live under data/villages/*.json as storage; they must
 * never surface as villages in the UI unless they pass `inDefconVillage`.
 */
import type { TalkIndexEntry, VillageEdition } from "./types";

export type HubId = "defcon" | "black-hat" | "bsides";

export type Hub = {
  id: HubId;
  /** Conference family slug used on talks/editions. */
  conference: string;
  label: string;
  href: string;
};

export const HUBS: Hub[] = [
  { id: "defcon", conference: "defcon", label: "DEF CON", href: "/defcon" },
  { id: "black-hat", conference: "black-hat", label: "Black Hat", href: "/black-hat" },
  { id: "bsides", conference: "bsides", label: "BSides", href: "/bsides" },
];

export function getHub(id: string): Hub | undefined {
  return HUBS.find((hub) => hub.id === id);
}

/** True when `eventSlug` refers to a real DEF CON event in events.json. */
export function isDefconEventSlug(eventSlug: string): boolean {
  return eventSlug.startsWith("defcon-") || eventSlug === "defcon-safe-mode";
}

type VillageLike = { conference: string; eventSlug: string };

/** Whether a talk/edition should appear in village facets, chips, and village URLs. */
export function inDefconVillage(item: VillageLike): boolean {
  return item.conference === "defcon" && isDefconEventSlug(item.eventSlug);
}

export function isDefconVillageTalk(
  talk: Pick<TalkIndexEntry, "conference" | "eventSlug">,
): boolean {
  return inDefconVillage(talk);
}

export function villageSeriesPath(villageSlug: string): string {
  return `/defcon/villages/${villageSlug}`;
}

export function villageEditionPath(
  edition: Pick<VillageEdition, "eventSlug" | "villageSlug">,
): string {
  return `/${edition.eventSlug}/${edition.villageSlug}`;
}
