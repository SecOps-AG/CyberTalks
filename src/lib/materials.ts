/**
 * Talk materials: slides, repos, and other links joined from data/materials/.
 *
 * Auto links are confidence >= 0.9, not dead, and not type "reference".
 * The review band is 0.7 up to but not including 0.9, with the same exclusions.
 * Anything else stays off the page.
 */

export const AUTO_CONFIDENCE = 0.9;
export const REVIEW_CONFIDENCE = 0.7;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DEAD_STATUS = new Set([0, 404, 410]);

export const MATERIAL_TYPES = [
  "slides",
  "repo",
  "paper",
  "whitepaper",
  "demo",
  "recording",
  "tool",
  "speaker-link",
  "reference",
  "link",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export type MaterialLink = {
  type: MaterialType;
  url: string;
  title?: string;
  source: string;
  confidence: number;
  dead?: boolean;
  blocked?: boolean;
  httpStatus?: number;
};

export type PublicMaterial = {
  type: MaterialType;
  url: string;
  label: string;
  source: string;
  confidence: number;
};

const TYPE_SET = new Set<string>(MATERIAL_TYPES);

export function isYouTubeId(id: string | null | undefined): boolean {
  return typeof id === "string" && YOUTUBE_ID.test(id);
}

/** Poster image. YouTube ids use the image host; other ids use a stored frame. */
export function thumbnailSrc(id: string, size: "hq" | "mq" = "hq"): string {
  if (isYouTubeId(id)) {
    const name = size === "mq" ? "mqdefault.jpg" : "hqdefault.jpg";
    return `https://i.ytimg.com/vi/${id}/${name}`;
  }
  return `/materials/thumbs/${id}.jpg`;
}

export function isMaterialType(value: unknown): value is MaterialType {
  return typeof value === "string" && TYPE_SET.has(value);
}

export function isDead(link: Pick<MaterialLink, "dead" | "httpStatus">): boolean {
  if (link.dead) return true;
  return typeof link.httpStatus === "number" && DEAD_STATUS.has(link.httpStatus);
}

export function displayTier(link: MaterialLink): "auto" | "review" | "hidden" {
  if (!link.url || link.type === "reference" || isDead(link)) return "hidden";
  if (link.confidence >= AUTO_CONFIDENCE) return "auto";
  if (link.confidence >= REVIEW_CONFIDENCE) return "review";
  return "hidden";
}

export function partitionMaterials(links: readonly MaterialLink[] | undefined): {
  auto: MaterialLink[];
  review: MaterialLink[];
} {
  const auto: MaterialLink[] = [];
  const review: MaterialLink[] = [];
  for (const link of links ?? []) {
    const tier = displayTier(link);
    if (tier === "auto") auto.push(link);
    else if (tier === "review") review.push(link);
  }
  return { auto, review };
}

export function hasSlides(links: readonly MaterialLink[] | undefined): boolean {
  return (links ?? []).some((link) => link.type === "slides" && displayTier(link) === "auto");
}

export function hasRepo(links: readonly MaterialLink[] | undefined): boolean {
  return (links ?? []).some((link) => link.type === "repo" && displayTier(link) === "auto");
}

/** Filename when the URL has one, otherwise the site host. */
export function materialLabel(link: Pick<MaterialLink, "type" | "url" | "title">): string {
  if (link.type === "recording") return "Watch on DEF CON media";
  try {
    const url = new URL(link.url);
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    if (last.includes(".")) return last;
    return url.hostname.replace(/^www\./, "");
  } catch {
    return link.title?.trim() || link.url;
  }
}

export function toPublicMaterial(link: MaterialLink): PublicMaterial {
  return {
    type: link.type,
    url: link.url,
    label: materialLabel(link),
    source: link.source,
    confidence: link.confidence,
  };
}

export function publicMaterialBands(links: readonly MaterialLink[] | undefined): {
  materials: PublicMaterial[];
  moreMaterials: PublicMaterial[];
} {
  const { auto, review } = partitionMaterials(links);
  return {
    materials: auto.map(toPublicMaterial),
    moreMaterials: review.map(toPublicMaterial),
  };
}

/** Drop unknown shapes. A hand-attached link with no score is treated as auto. */
export function normalizeMaterial(value: unknown): MaterialLink | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isMaterialType(row.type)) return null;
  if (typeof row.url !== "string" || !/^https?:\/\//.test(row.url)) return null;
  const confidence =
    typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0.96;
  const link: MaterialLink = {
    type: row.type,
    url: row.url,
    source: typeof row.source === "string" && row.source.trim() ? row.source.trim() : hostOf(row.url),
    confidence,
  };
  if (typeof row.title === "string" && row.title.trim()) link.title = row.title.trim();
  if (row.dead === true) link.dead = true;
  if (row.blocked === true) link.blocked = true;
  if (typeof row.httpStatus === "number" && Number.isFinite(row.httpStatus)) {
    link.httpStatus = row.httpStatus;
  }
  return link;
}

export function normalizeMaterials(value: unknown): MaterialLink[] {
  if (!Array.isArray(value)) return [];
  const links: MaterialLink[] = [];
  for (const item of value) {
    const link = normalizeMaterial(item);
    if (link) links.push(link);
  }
  return links;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
