import assert from "node:assert/strict";
import test from "node:test";
import {
  displayTier,
  hasRepo,
  hasSlides,
  isYouTubeId,
  materialLabel,
  normalizeMaterial,
  partitionMaterials,
  thumbnailSrc,
  type MaterialLink,
} from "./materials";

function link(over: Partial<MaterialLink> & Pick<MaterialLink, "type" | "url">): MaterialLink {
  return {
    source: "media.defcon.org",
    confidence: 0.96,
    ...over,
  };
}

test("auto, review, dead, and reference bands", () => {
  const slides = link({ type: "slides", url: "https://media.defcon.org/talk.pdf", confidence: 0.96 });
  const review = link({ type: "slides", url: "https://media.defcon.org/maybe.pdf", confidence: 0.77 });
  const low = link({ type: "link", url: "https://example.com/a", confidence: 0.5 });
  const dead = link({
    type: "repo",
    url: "https://github.com/gone/repo",
    confidence: 0.96,
    httpStatus: 404,
    dead: true,
  });
  const reference = link({
    type: "reference",
    url: "https://en.wikipedia.org/wiki/X",
    confidence: 0.96,
  });
  assert.equal(displayTier(slides), "auto");
  assert.equal(displayTier(review), "review");
  assert.equal(displayTier(low), "hidden");
  assert.equal(displayTier(dead), "hidden");
  assert.equal(displayTier(reference), "hidden");
  const bands = partitionMaterials([slides, review, low, dead, reference]);
  assert.deepEqual(bands.auto.map((item) => item.url), [slides.url]);
  assert.deepEqual(bands.review.map((item) => item.url), [review.url]);
  assert.equal(hasSlides([slides, review]), true);
  assert.equal(hasSlides([review]), false);
  assert.equal(hasRepo([dead]), false);
  assert.equal(hasRepo([link({ type: "repo", url: "https://github.com/a/b", confidence: 0.9 })]), true);
});

test("recording label, filename label, and thumbnails", () => {
  assert.equal(
    materialLabel(link({ type: "recording", url: "https://media.defcon.org/a/talk.mp4" })),
    "Watch on DEF CON media",
  );
  assert.equal(
    materialLabel(
      link({
        type: "slides",
        url: "https://media.defcon.org/DEF%20CON%2033/Ben%20Gardiner%20-%20Blind.pdf",
      }),
    ),
    "Ben Gardiner - Blind.pdf",
  );
  assert.equal(
    materialLabel(link({ type: "repo", url: "https://github.com/ECP5-PCIe/ECP5-PCIe" })),
    "github.com",
  );
  assert.equal(isYouTubeId("sbkeEwhWIks"), true);
  assert.equal(isYouTubeId("dc33-371097c2"), false);
  assert.equal(thumbnailSrc("sbkeEwhWIks"), "https://i.ytimg.com/vi/sbkeEwhWIks/hqdefault.jpg");
  assert.equal(thumbnailSrc("dc33-371097c2"), "/materials/thumbs/dc33-371097c2.jpg");
});

test("a link attached without a score stays in the auto band", () => {
  const link = normalizeMaterial({
    type: "slides",
    url: "https://media.defcon.org/slides.pdf",
    source: "media.defcon.org",
  });
  assert.ok(link);
  assert.equal(link?.confidence, 0.96);
  assert.equal(displayTier(link!), "auto");
});
