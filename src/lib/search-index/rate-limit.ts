/**
 * Best-effort per-isolate limiter. Workers do not share this map across isolates,
 * so it caps a hot isolate without a paid rate-limiting binding.
 */

import { RATE_LIMIT, RATE_WINDOW_MS } from "./format";

type Bucket = { start: number; count: number };

const buckets = new Map<string, Bucket>();
let operations = 0;

export type RateDecision = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
};

export function resetRateLimits(): void {
  buckets.clear();
  operations = 0;
}

export function consumeRateLimit(
  key: string,
  now = Date.now(),
  limit = RATE_LIMIT,
  windowMs = RATE_WINDOW_MS,
): RateDecision {
  operations += 1;
  if (operations % 50 === 0) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.start >= windowMs) buckets.delete(bucketKey);
    }
    if (buckets.size > 5000) buckets.clear();
  }

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000));
    return { ok: false, limit, remaining: 0, retryAfter };
  }
  bucket.count += 1;
  return { ok: true, limit, remaining: limit - bucket.count, retryAfter: 0 };
}

export function clientKey(request: Request): string {
  const connecting = request.headers.get("cf-connecting-ip")?.trim();
  if (connecting) return connecting;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "local";
}
