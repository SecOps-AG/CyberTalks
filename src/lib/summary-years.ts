/** Years whose summary shard still needs a fetch. Already-loaded years are skipped. */
export function summaryYearsToLoad(
  loaded: ReadonlySet<number>,
  talks: readonly { year: number }[],
): number[] {
  const next: number[] = [];
  const seen = new Set<number>();
  for (const talk of talks) {
    if (!Number.isFinite(talk.year)) continue;
    if (loaded.has(talk.year) || seen.has(talk.year)) continue;
    seen.add(talk.year);
    next.push(talk.year);
  }
  return next;
}
