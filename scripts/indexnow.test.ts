import assert from "node:assert/strict";
import test from "node:test";
import {
  INDEXNOW_BATCH_SIZE,
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  changedSlugs,
  chunk,
  pingIndexNow,
  talkUrl,
} from "./indexnow";

type Call = { url: string; init?: RequestInit };

function mockFetch(keyBody: string | number, postStatus = 200) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === INDEXNOW_KEY_LOCATION) {
      return typeof keyBody === "number"
        ? new Response("not found", { status: keyBody })
        : new Response(`${keyBody}\n`, { status: 200 });
    }
    return new Response("", { status: postStatus });
  };
  return { calls, fetchImpl };
}

const quiet = () => {};

test("builds absolute talk URLs on the apex host", () => {
  assert.equal(talkUrl("my-talk"), "https://cybertalks.org/talks/my-talk");
});

test("chunk splits at the batch size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test("sends nothing and makes no request when the key file is not live", async () => {
  for (const body of [404, "something else"]) {
    const { calls, fetchImpl } = mockFetch(body);
    const result = await pingIndexNow(["a"], { fetch: fetchImpl, log: quiet });
    assert.equal(result.status, "key-not-live");
    assert.deepEqual(calls.map((c) => c.url), [INDEXNOW_KEY_LOCATION]);
  }
});

test("a failing key request is logged, not thrown", async () => {
  const fetchImpl = async () => {
    throw new Error("offline");
  };
  const result = await pingIndexNow(["a"], { fetch: fetchImpl, log: quiet });
  assert.equal(result.status, "key-not-live");
});

test("posts the documented body once the key is live", async () => {
  const { calls, fetchImpl } = mockFetch(INDEXNOW_KEY);
  const result = await pingIndexNow(["a", "b", "a"], { fetch: fetchImpl, log: quiet });
  assert.deepEqual(result, { status: "sent", urls: 2, batches: 1, failedBatches: 0 });
  const post = calls.find((c) => c.url === INDEXNOW_ENDPOINT);
  assert.ok(post);
  assert.equal(post.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(post.init?.body)), {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: ["https://cybertalks.org/talks/a", "https://cybertalks.org/talks/b"],
  });
});

test("batches at 10,000 URLs per request", async () => {
  const slugs = Array.from({ length: INDEXNOW_BATCH_SIZE * 2 + 5 }, (_, i) => `t${i}`);
  const { calls, fetchImpl } = mockFetch(INDEXNOW_KEY);
  const result = await pingIndexNow(slugs, { fetch: fetchImpl, log: quiet });
  assert.equal(result.status, "sent");
  const posts = calls.filter((c) => c.url === INDEXNOW_ENDPOINT);
  assert.deepEqual(
    posts.map((c) => JSON.parse(String(c.init?.body)).urlList.length),
    [10_000, 10_000, 5],
  );
});

test("a rejected batch does not throw and later batches still go out", async () => {
  const slugs = Array.from({ length: INDEXNOW_BATCH_SIZE + 1 }, (_, i) => `t${i}`);
  const { calls, fetchImpl } = mockFetch(INDEXNOW_KEY, 429);
  const result = await pingIndexNow(slugs, { fetch: fetchImpl, log: quiet });
  assert.deepEqual(result, { status: "sent", urls: INDEXNOW_BATCH_SIZE + 1, batches: 2, failedBatches: 2 });
  assert.equal(calls.filter((c) => c.url === INDEXNOW_ENDPOINT).length, 2);
});

test("dry run and an empty list make no network calls", async () => {
  const { calls, fetchImpl } = mockFetch(INDEXNOW_KEY);
  assert.deepEqual(await pingIndexNow(["a"], { fetch: fetchImpl, dryRun: true, log: quiet }), {
    status: "dry-run",
    urls: 1,
    batches: 1,
  });
  assert.deepEqual(await pingIndexNow([], { fetch: fetchImpl, log: quiet }), {
    status: "nothing-to-send",
  });
  assert.equal(calls.length, 0);
});

test("changedSlugs reports new and edited talks, ignoring view-count refreshes", () => {
  const before = [
    { slug: "same", title: "Same", viewCount: 1 },
    { slug: "edited", title: "Old" },
    { slug: "gone", title: "Gone" },
  ];
  const after = [
    { slug: "same", title: "Same", viewCount: 99, likeCount: 4, commentCount: 1, viewCountFetchedAt: "2026-11-09" },
    { slug: "edited", title: "New" },
    { slug: "fresh", title: "Fresh" },
  ];
  assert.deepEqual(changedSlugs(before, after).sort(), ["edited", "fresh"]);
});
