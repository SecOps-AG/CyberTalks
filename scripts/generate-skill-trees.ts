/**
 * Resolve data/skill-trees.json (talks listed by youtubeId) against the archive
 * and write src/generated/skill-trees.json for the /skill-tree page.
 *
 * A talk's tier is the `tier` set in the tree, else its difficulty. The build
 * fails if a listed talk is missing, has no tier, or is listed twice in one field.
 *
 *   npx tsx scripts/generate-skill-trees.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTalks } from "../src/lib/data";
import { conferenceLabel, normalizeDifficulty } from "../src/lib/labels";
import type { SkillTreeFile } from "../src/lib/skill-tree";
import type { Talk } from "../src/lib/types";

type SourceTalk = string | { youtubeId: string; tier?: string; after?: string[]; icon?: string };
type SourceFile = {
  fields: {
    slug: string;
    name: string;
    blurb: string;
    track: string;
    branches: { name: string; talks: SourceTalk[] }[];
  }[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  fs.readFileSync(path.join(root, "data", "skill-trees.json"), "utf8"),
) as SourceFile;

const talks = getTalks();
const byYoutubeId = new Map<string, Talk>();
for (const talk of talks) {
  const seen = byYoutubeId.get(talk.youtubeId);
  // Keep the copy with a difficulty when a video sits in more than one file.
  if (!seen || (!seen.difficulty && talk.difficulty)) byYoutubeId.set(talk.youtubeId, talk);
}

const errors: string[] = [];

/** Channel uploads carry placeholder group names; show the conference instead. */
const GENERIC_GROUP = /^(videos|briefings|channel videos|keynotes?)$/i;
function eventLabel(talk: Talk): string {
  const group = talk.villageName.trim();
  if (group && !GENERIC_GROUP.test(group)) {
    // DEF CON villages read better with the conference in front.
    return talk.conference === "defcon" && !/def ?con/i.test(group) ? `DEF CON · ${group}` : group;
  }
  // "community" and similar catch-all families have no useful label.
  const conference = conferenceLabel(talk.conference);
  return conference === conference.toUpperCase() && conference.length > 6 ? "" : conference;
}

/** Channel uploads often start the title with the speaker or the event: drop that. */
function cleanTitle(talk: Talk): string {
  let title = talk.title.trim();
  for (const speaker of talk.speakers) {
    for (const sep of [" - ", ": ", " – "]) {
      if (title.toLowerCase().startsWith(`${speaker.toLowerCase()}${sep}`)) return title.slice(speaker.length + sep.length);
    }
  }
  title = title.replace(/^DEF CON \d+[^-:]*[-:]\s*/, "");
  return title;
}

/** The written summary's overview when there is one, else the card teaser. */
function blurbFor(talk: Talk): string {
  const summary = talk.summary;
  const overview =
    summary && typeof summary === "object" && typeof summary.overview === "string"
      ? summary.overview
      : typeof summary === "string"
        ? summary
        : "";
  // Summaries are markdown: drop headings and emphasis, keep the first paragraph.
  const firstParagraph = overview
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s.*$/gm, "").replace(/[*_`]+/g, "").trim())
    .find((p) => p.length > 0);
  const text = (firstParagraph || talk.teaser || "").replace(/\s+/g, " ").trim();
  return text.length > 360 ? `${text.slice(0, 357).replace(/\s+\S*$/, "")}…` : text;
}

const out: SkillTreeFile = {
  fields: source.fields.map((field) => {
    const inField = new Set<string>();
    const branches = field.branches.map((branch) => ({
      name: branch.name,
      talks: branch.talks.flatMap((entry) => {
        const ref = typeof entry === "string" ? { youtubeId: entry } : entry;
        const where = `${field.slug} / ${branch.name} / ${ref.youtubeId}`;
        const talk = byYoutubeId.get(ref.youtubeId);
        if (!talk) {
          errors.push(`${where}: not in the archive`);
          return [];
        }
        const tier = normalizeDifficulty(ref.tier) ?? normalizeDifficulty(talk.difficulty);
        if (ref.tier && !normalizeDifficulty(ref.tier)) errors.push(`${where}: unknown tier ${ref.tier}`);
        if (!tier) {
          errors.push(`${where}: has no tier or difficulty`);
          return [];
        }
        if (inField.has(ref.youtubeId)) errors.push(`${where}: listed twice in this field`);
        inField.add(ref.youtubeId);
        return [
          {
            id: talk.id,
            youtubeId: talk.youtubeId,
            slug: talk.slug,
            title: cleanTitle(talk),
            speakers: talk.speakers,
            event: eventLabel(talk),
            durationSeconds: talk.durationSeconds ?? 0,
            tier,
            teaser: blurbFor(talk),
            after: ref.after ?? [],
            icon: ref.icon ?? "",
          },
        ];
      }),
    }));
    for (const branch of branches) {
      for (const talk of branch.talks) {
        for (const id of talk.after) {
          if (!inField.has(id)) errors.push(`${field.slug} / ${talk.youtubeId}: after ${id} is not in this field`);
        }
      }
    }
    return {
      slug: field.slug,
      name: field.name,
      blurb: field.blurb,
      track: field.track,
      branches,
    };
  }),
};

if (errors.length > 0) {
  console.error(`skill-trees: ${errors.length} problem(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const file = path.join(root, "src", "generated", "skill-trees.json");
fs.writeFileSync(file, JSON.stringify(out) + "\n");
const count = out.fields.reduce((n, f) => n + f.branches.reduce((m, b) => m + b.talks.length, 0), 0);
console.log(`skill-trees: ${out.fields.length} fields, ${count} talks → ${path.relative(root, file)}`);
