import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWatchStats } from "./fetch-view-counts.mjs";

function page(body) {
  return `${body}${"x".repeat(20000)}`;
}

describe("parseWatchStats", () => {
  it("reads exact view and like counts", () => {
    const stats = parseWatchStats(
      page(`"originalViewCount":"1794749" like this video along with 26,059 other people`),
    );
    assert.deepEqual(stats, { viewCount: 1794749, likeCount: 26059, commentCount: null });
  });

  it("reads a single like and an unabbreviated factoid", () => {
    const stats = parseWatchStats(
      page(`"simpleText":"1,234 views" "simpleText":"56"},"label":{"simpleText":"Likes"}`),
    );
    assert.deepEqual(stats, { viewCount: 1234, likeCount: 56, commentCount: null });
  });

  it("does not turn an abbreviated count into an integer", () => {
    assert.equal(parseWatchStats(page(`"shortViewCount":{"simpleText":"1.7M views"}`)), null);
    const stats = parseWatchStats(
      page(`"originalViewCount":"10" "simpleText":"26K"},"label":{"simpleText":"Likes"}`),
    );
    assert.equal(stats.viewCount, 10);
    assert.equal(stats.likeCount, null);
  });

  it("records a comment count when the page includes one", () => {
    const stats = parseWatchStats(page(`"originalViewCount":"10" "simpleText":"3 Comments"`));
    assert.equal(stats.commentCount, 3);
  });

  it("rejects a short page", () => {
    assert.equal(parseWatchStats(`"originalViewCount":"10"`), null);
  });
});
