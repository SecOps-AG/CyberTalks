"use client";

import { useEffect, useState } from "react";

const REPO = "SecOps-AG/CyberTalks";
const REPO_URL = `https://github.com/${REPO}`;

function formatCount(count: number) {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}

/**
 * Star count is read in the browser rather than at build time so the header
 * stays a static, cacheable part of every page.
 */
export function GitHubStarButton() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`https://api.github.com/repos/${REPO}`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (typeof data?.stargazers_count === "number") setStars(data.stargazers_count);
      })
      // A missing count is not worth surfacing: the button still links to the repo.
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="chip"
      title={`Star ${REPO} on GitHub`}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      Star
      {stars !== null ? (
        <span className="border-l border-acid/25 pl-1.5 tabular-nums text-mint/70">
          {formatCount(stars)}
        </span>
      ) : null}
    </a>
  );
}
