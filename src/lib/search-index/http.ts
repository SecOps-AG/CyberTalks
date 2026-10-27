import { clientKey, consumeRateLimit, type RateDecision } from "./rate-limit";

export function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, Accept");
  headers.set("access-control-max-age", "86400");
  headers.set("access-control-expose-headers", "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After");
  headers.set("x-robots-tag", "noindex");
  return headers;
}

function withRate(headers: Headers, decision: RateDecision): void {
  headers.set("x-ratelimit-limit", String(decision.limit));
  headers.set("x-ratelimit-remaining", String(decision.remaining));
}

export function apiJson(
  body: unknown,
  status: number,
  decision: RateDecision,
  cache: "public" | "short" | "none" = status === 200 ? "public" : "none",
): Response {
  const headers = corsHeaders();
  headers.set("content-type", "application/json; charset=utf-8");
  withRate(headers, decision);
  if (cache === "public") {
    headers.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
    headers.set("cdn-cache-control", "public, max-age=300");
  } else if (cache === "short") {
    headers.set("cache-control", "public, max-age=30");
    headers.set("cdn-cache-control", "public, max-age=30");
  } else {
    headers.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function rateLimited(decision: RateDecision): Response {
  const response = apiJson(
    {
      error: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAfter: decision.retryAfter,
    },
    429,
    decision,
    "none",
  );
  response.headers.set("retry-after", String(decision.retryAfter));
  return response;
}

export function limitRequest(request: Request): RateDecision {
  return consumeRateLimit(clientKey(request));
}
