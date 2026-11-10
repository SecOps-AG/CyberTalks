/**
 * Count the talks behind every one-word speaker credit and write the ones with
 * two or more to src/generated/one-word-speakers.json. A one-word credit gets
 * a speaker page only when it is listed there (see src/lib/speaker-credits.ts),
 * so this runs before anything that builds the speaker index.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTalks } from "../src/lib/data";
import { countOneWordSpeakers } from "../src/lib/speaker-credits";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src", "generated", "one-word-speakers.json");

const counts = countOneWordSpeakers(getTalks());
fs.writeFileSync(file, `${JSON.stringify(counts)}\n`);
console.log(`One-word speakers with 2+ talks: ${Object.keys(counts).length}.`);
