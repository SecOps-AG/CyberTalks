import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogUniverse, shouldFetchTalkIndex, talkGridPhase } from "@/lib/home-catalog";

const idle = {
  defer: true,
  viewNeedsIndex: false,
  indexReady: false,
  batchApplied: false,
  failed: false,
};

describe("homepage talk index", () => {
  it("stays frozen and does not download while the first page is idle", () => {
    assert.equal(talkGridPhase(idle), "frozen");
    assert.equal(
      shouldFetchTalkIndex({
        remote: true,
        defer: true,
        viewNeedsIndex: false,
        stagedNeedsIndex: false,
      }),
      false,
    );
  });

  it("waits for the first batch once a query or filter is active", () => {
    assert.equal(talkGridPhase({ ...idle, viewNeedsIndex: true }), "waiting");
    assert.equal(
      shouldFetchTalkIndex({
        remote: true,
        defer: true,
        viewNeedsIndex: true,
        stagedNeedsIndex: false,
      }),
      true,
    );
  });

  it("shows partial results while later shards are still arriving", () => {
    assert.equal(
      talkGridPhase({ ...idle, viewNeedsIndex: true, batchApplied: true }),
      "partial",
    );
  });

  it("shows an error instead of searching whatever has landed", () => {
    assert.equal(
      talkGridPhase({ ...idle, viewNeedsIndex: true, batchApplied: true, failed: true }),
      "error",
    );
    assert.equal(talkGridPhase({ ...idle, failed: true }), "frozen");
  });

  it("starts a phone filter download only after a control changes", () => {
    assert.equal(
      shouldFetchTalkIndex({
        remote: true,
        defer: true,
        viewNeedsIndex: false,
        stagedNeedsIndex: true,
      }),
      true,
    );
  });

  it("still loads immediately on pages that are not deferred", () => {
    assert.equal(
      shouldFetchTalkIndex({
        remote: true,
        defer: false,
        viewNeedsIndex: false,
        stagedNeedsIndex: false,
      }),
      true,
    );
    assert.equal(talkGridPhase({ ...idle, defer: false }), "ready");
  });
});

describe("homepage result count", () => {
  it("shows the whole catalog, not the first page, before the index loads", () => {
    assert.equal(catalogUniverse({ catalogSize: 52096, loadedTalks: 24, indexPending: true }), 52096);
  });

  it("uses the loaded catalog once the index is in", () => {
    assert.equal(catalogUniverse({ catalogSize: 52096, loadedTalks: 52100, indexPending: false }), 52100);
    assert.equal(catalogUniverse({ catalogSize: undefined, loadedTalks: 12, indexPending: true }), 12);
  });
});
