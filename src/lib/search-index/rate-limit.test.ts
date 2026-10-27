import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientKey, consumeRateLimit, resetRateLimits } from "./rate-limit";

describe("rate limit", () => {
  it("allows a burst then rejects until the window passes", () => {
    resetRateLimits();
    const first = consumeRateLimit("10.0.0.1", 1_000, 2, 60_000);
    const second = consumeRateLimit("10.0.0.1", 1_100, 2, 60_000);
    const third = consumeRateLimit("10.0.0.1", 1_200, 2, 60_000);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.remaining, 0);
    assert.equal(third.ok, false);
    if (!third.ok) assert.ok(third.retryAfter >= 1);

    const later = consumeRateLimit("10.0.0.1", 61_200, 2, 60_000);
    assert.equal(later.ok, true);

    const other = consumeRateLimit("10.0.0.2", 1_200, 2, 60_000);
    assert.equal(other.ok, true);
  });

  it("prefers the Cloudflare connecting IP", () => {
    const request = new Request("https://cybertalks.org/api/v1/search", {
      headers: {
        "cf-connecting-ip": "203.0.113.8",
        "x-forwarded-for": "198.51.100.4, 203.0.113.8",
      },
    });
    assert.equal(clientKey(request), "203.0.113.8");
    const local = new Request("https://cybertalks.org/api/v1/search");
    assert.equal(clientKey(local), "local");
  });
});
