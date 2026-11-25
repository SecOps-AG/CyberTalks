import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getStats, getTalks, getTrackCounts } from "../lib/data";
import type { Track } from "../lib/types";
import { TrackChart } from "./TrackChart";

const malware: Track = {
  slug: "malware",
  name: "Malware",
  stance: "offense",
  blurb: "",
};

describe("By Track caption", () => {
  it("uses the archive total when some talks are not on a bar", () => {
    const html = renderToStaticMarkup(
      createElement(TrackChart, {
        counts: [{ track: malware, count: 3 }],
        totalTalks: 10,
      }),
    );
    assert.match(html, /10 talks across 1 tracks/);
  });

  it("matches the site total, including talks with no track", () => {
    const stats = getStats();
    const counts = getTrackCounts();
    const html = renderToStaticMarkup(
      createElement(TrackChart, { counts, totalTalks: stats.talks }),
    );
    assert.match(
      html,
      new RegExp(`${stats.talks.toLocaleString("en-US")} talks across ${counts.length} tracks`),
    );
    const bars = counts.reduce((sum, entry) => sum + entry.count, 0);
    const untracked = getTalks().filter((talk) => talk.track.trim() === "").length;
    assert.equal(stats.talks, bars + untracked);
  });
});
