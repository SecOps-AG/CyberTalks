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
  difficulty: Difficulty;
  /** Own-words overview, or the card teaser. */
  teaser: string;
  /** youtubeIds of talks elsewhere in the field that also unlock this one. */
  after: string[];
};

export type SkillBranch = { name: string; talks: SkillTalk[] };

export type SkillField = {
  slug: string;
  name: string;
  blurb: string;
  track: string;
  rated: Record<Difficulty, number>;
  unrated: number;
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
 * Icon tree geometry, in world pixels. Talks are round nodes placed at their
 * tier's column; several talks in one tier of a branch fork side by side.
 * A field emblem on the left feeds a trunk, the trunk feeds one gate per
 * branch, and each branch ends in a capstone with the branch name.
 */
export const LAYOUT = {
  rootX: 64,
  rootR: 40,
  trunkX: 136,
  gateX: 188,
  tierX: [330, 570, 810, 1050],
  capX: 1210,
  /** Branch name starts here, right of the capstone. */
  labelX: 1246,
  width: 1440,
  /** Talk node radius by tier: deeper tiers are a little bigger. */
  nodeR: [15, 16, 17, 19],
  capR: 24,
  /** Vertical step between talks in one tier; they also zigzag sideways by `stagger`. */
  rowGap: 30,
  stagger: 19,
  lanePad: 8,
  laneGap: 6,
} as const;

export type PlacedTalk = SkillTalk & {
  key: string;
  branchIndex: number;
  /** Node center. */
  x: number;
  y: number;
  r: number;
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
  /** Field emblem center height. */
  rootY: number;
  branches: PlacedBranch[];
  talks: PlacedTalk[];
  byYoutubeId: Map<string, PlacedTalk>;
};

export function layoutField(field: SkillField): FieldLayout {
  const L = LAYOUT;
  const branches: PlacedBranch[] = [];
  const all: PlacedTalk[] = [];
  const maxR = Math.max(...L.nodeR);
  let y = 0;

  field.branches.forEach((branch, branchIndex) => {
    const columns: SkillTalk[][] = [[], [], [], []];
    for (const talk of branch.talks) columns[TIER_INDEX[talk.difficulty]].push(talk);
    const rows = Math.max(1, ...columns.map((c) => c.length));
    const height = (rows - 1) * L.rowGap + maxR * 2 + L.lanePad * 2;
    const centerY = y + height / 2;

    const placed: PlacedTalk[] = [];
    columns.forEach((column, tier) => {
      column.forEach((talk, row) => {
        placed.push({
          ...talk,
          key: `${branchIndex}:${talk.youtubeId}`,
          branchIndex,
          x: L.tierX[tier] + (column.length > 1 ? (row % 2 === 0 ? -L.stagger : L.stagger) : 0),
          y: centerY + (row - (column.length - 1) / 2) * L.rowGap,
          r: L.nodeR[tier],
          parents: [],
        });
      });
    });

    for (const talk of placed) {
      const tier = TIER_INDEX[talk.difficulty];
      const lower = placed.filter((p) => TIER_INDEX[p.difficulty] < tier);
      const nearest = Math.max(-1, ...lower.map((p) => TIER_INDEX[p.difficulty]));
      const own = lower.filter((p) => TIER_INDEX[p.difficulty] === nearest).map((p) => p.youtubeId);
      talk.parents = [...new Set([...own, ...talk.after])];
    }

    branches.push({ name: branch.name, index: branchIndex, y, height, centerY, talks: placed });
    all.push(...placed);
    y += height + L.laneGap;
  });

  const height = Math.max(L.rootR * 2 + 40, y - L.laneGap);
  // Shift everything down if the field is shorter than the emblem.
  const shift = (height - Math.max(0, y - L.laneGap)) / 2;
  if (shift > 0) {
    for (const b of branches) {
      b.y += shift;
      b.centerY += shift;
    }
    for (const t of all) t.y += shift;
  }

  return {
    width: L.width,
    height,
    rootY: height / 2,
    branches,
    talks: all,
    byYoutubeId: new Map(all.map((t) => [t.youtubeId, t])),
  };
}

/** Talks with no later talk in their branch: they feed the capstone. */
export function branchLeaves(branch: PlacedBranch): PlacedTalk[] {
  const top = Math.max(...branch.talks.map((t) => TIER_INDEX[t.difficulty]));
  return branch.talks.filter((t) => TIER_INDEX[t.difficulty] === top);
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
