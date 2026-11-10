/**
 * Skill tree model: layout, unlock rules and ranks. Pure — safe on server and client.
 *
 * A field (one track) has branches. Each branch is a horizontal lane; tiers
 * (beginner → expert) are columns. Within a branch a talk is unlocked by the
 * talks in the nearest lower tier of that branch, plus any `after` talks.
 * Talks with nothing below them are entry points and start unlocked.
 */
import type { Difficulty } from "./types";

export type SkillTalk = {
  id: string;
  youtubeId: string;
  slug: string;
  title: string;
  speakers: string[];
  /** Conference or event group, for a chip. */
  event: string;
  durationSeconds: number;
  /** Column in the tree. Usually the talk's difficulty; set per tree when curated. */
  tier: Difficulty;
  /** Own-words overview, or the card teaser. */
  teaser: string;
  /** youtubeIds of talks elsewhere in the field that also unlock this one. */
  after: string[];
  /** Line icon name for the card (see app/skill-tree/icons). Empty = blank socket. */
  icon?: string;
};

export type SkillBranch = { name: string; talks: SkillTalk[] };

export type SkillField = {
  slug: string;
  name: string;
  blurb: string;
  track: string;
  branches: SkillBranch[];
};

export type SkillTreeFile = { fields: SkillField[] };

export const TIERS: { level: Difficulty; numeral: string; name: string }[] = [
  { level: "beginner", numeral: "I", name: "Beginner" },
  { level: "intermediate", numeral: "II", name: "Intermediate" },
  { level: "advanced", numeral: "III", name: "Advanced" },
  { level: "expert", numeral: "IV", name: "Expert" },
];

export const TIER_INDEX: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export const RANKS = [
  { name: "Operator", minSeconds: 0 },
  { name: "Specialist", minSeconds: 4 * 3600 },
  { name: "Elite", minSeconds: 10 * 3600 },
] as const;

/**
 * Card tree geometry, in world pixels. A field emblem on the left feeds one
 * hub per branch (progress ring plus name); talks are cards in tier columns,
 * stacked when a branch has several talks in one tier.
 */
export const LAYOUT = {
  rootX: 40,
  rootW: 170,
  rootH: 190,
  hubX: 250,
  hubW: 380,
  ringW: 60,
  cardW: 260,
  cardH: 64,
  /** Left edge of the first tier column, and the step between columns. */
  firstTierX: 750,
  tierStep: 430,
  /** Space after the last column. */
  endPad: 70,
  /** Gap between stacked cards, padding inside a lane, gap between lanes. */
  cardGap: 10,
  lanePad: 18,
  laneGap: 14,
  top: 20,
  bottom: 20,
} as const;

export type PlacedTalk = SkillTalk & {
  key: string;
  branchIndex: number;
  /** Card top-left corner. */
  x: number;
  y: number;
  /** youtubeIds of the talks that unlock this one. Empty = entry point. */
  parents: string[];
};

export type PlacedBranch = {
  name: string;
  index: number;
  y: number;
  height: number;
  centerY: number;
  talks: PlacedTalk[];
};

export type FieldLayout = {
  width: number;
  height: number;
  /** Left edge of each tier column. */
  tierX: number[];
  /** Field emblem center height. */
  rootY: number;
  branches: PlacedBranch[];
  talks: PlacedTalk[];
  byYoutubeId: Map<string, PlacedTalk>;
};

export function layoutField(field: SkillField): FieldLayout {
  const L = LAYOUT;
  const tierX = [0, 1, 2, 3].map((t) => L.firstTierX + t * L.tierStep);
  const branches: PlacedBranch[] = [];
  const all: PlacedTalk[] = [];
  let y = L.top;

  field.branches.forEach((branch, branchIndex) => {
    const columns: SkillTalk[][] = [[], [], [], []];
    for (const talk of branch.talks) columns[TIER_INDEX[talk.tier]].push(talk);
    const stack = (n: number) => n * L.cardH + Math.max(0, n - 1) * L.cardGap;
    const rows = Math.max(1, ...columns.map((c) => c.length));
    const height = stack(rows) + L.lanePad * 2;

    const placed: PlacedTalk[] = [];
    columns.forEach((column, tier) => {
      const top = y + (height - stack(column.length)) / 2;
      column.forEach((talk, row) => {
        placed.push({
          ...talk,
          key: `${branchIndex}:${talk.youtubeId}`,
          branchIndex,
          x: tierX[tier],
          y: Math.round(top + row * (L.cardH + L.cardGap)),
          parents: [],
        });
      });
    });

    for (const talk of placed) {
      const tier = TIER_INDEX[talk.tier];
      const lower = placed.filter((p) => TIER_INDEX[p.tier] < tier);
      const nearest = Math.max(-1, ...lower.map((p) => TIER_INDEX[p.tier]));
      const own = lower.filter((p) => TIER_INDEX[p.tier] === nearest).map((p) => p.youtubeId);
      talk.parents = [...new Set([...own, ...talk.after])];
    }

    branches.push({ name: branch.name, index: branchIndex, y, height, centerY: y + height / 2, talks: placed });
    all.push(...placed);
    y += height + L.laneGap;
  });

  const contentBottom = y - L.laneGap + L.bottom;
  const height = Math.max(L.rootH + L.top + L.bottom, contentBottom);
  // Center short fields on the emblem.
  const shift = (height - contentBottom) / 2;
  if (shift > 0) {
    for (const b of branches) {
      b.y += shift;
      b.centerY += shift;
    }
    for (const t of all) t.y += shift;
  }

  return {
    width: tierX[3] + L.cardW + L.endPad,
    height,
    tierX,
    rootY: height / 2,
    branches,
    talks: all,
    byYoutubeId: new Map(all.map((t) => [t.youtubeId, t])),
  };
}

export type TalkStatus = "watched" | "ready" | "locked";

/** True when the saved-store id list contains this talk (any archive copy of the video). */
export function watchedIn(watched: ReadonlySet<string>, talk: Pick<SkillTalk, "id" | "youtubeId">): boolean {
  if (watched.has(talk.id)) return true;
  for (const id of watched) if (id.endsWith(`-${talk.youtubeId}`)) return true;
  return false;
}

export function talkStatus(
  talk: PlacedTalk,
  layout: FieldLayout,
  watched: ReadonlySet<string>,
): TalkStatus {
  if (watchedIn(watched, talk)) return "watched";
  if (talk.parents.length === 0) return "ready";
  return talk.parents.some((id) => {
    const parent = layout.byYoutubeId.get(id);
    return parent ? watchedIn(watched, parent) : false;
  })
    ? "ready"
    : "locked";
}

export type RankProgress = {
  rank: (typeof RANKS)[number];
  rankIndex: number;
  next: (typeof RANKS)[number] | null;
  watchedSeconds: number;
  watchedTalks: number;
  /** 0–1 along the whole ladder, for the bar. */
  ladder: number;
};

export function rankFor(layout: FieldLayout, watched: ReadonlySet<string>): RankProgress {
  const done = layout.talks.filter((t) => watchedIn(watched, t));
  const watchedSeconds = done.reduce((sum, t) => sum + t.durationSeconds, 0);
  let rankIndex = 0;
  RANKS.forEach((r, i) => {
    if (watchedSeconds >= r.minSeconds) rankIndex = i;
  });
  const top = RANKS[RANKS.length - 1].minSeconds;
  return {
    rank: RANKS[rankIndex],
    rankIndex,
    next: RANKS[rankIndex + 1] ?? null,
    watchedSeconds,
    watchedTalks: done.length,
    ladder: Math.min(1, watchedSeconds / top),
  };
}

/** "4h 26m" — always hours and minutes, for the stats box. */
export function hoursMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
