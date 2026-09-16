import { getEvents, getEditions, getCoverageByVillage, getCoverageForEvent } from "@/lib/data";
import Link from "next/link";

export const metadata = {
  title: "Coverage Report",
  description: "Summary coverage across DEF CON events and villages",
};

export default function CoveragePage() {
  const events = getEvents();
  const editions = getEditions();
  const villageCoverage = getCoverageByVillage();

  const eventStats = events.map((event) => ({
    event,
    stats: getCoverageForEvent(event.slug),
  }));

  const totalStats = {
    totalTalks: editions.reduce((sum, e) => sum + e.talkCount, 0),
    talksWithSummary: villageCoverage.reduce((sum, v) => sum + v.stats.talksWithSummary, 0),
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Archive Coverage Report</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Overall Statistics</h2>
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg">
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="font-semibold">Total Talks</dt>
              <dd className="font-mono">{totalStats.totalTalks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold">Talks with Summaries</dt>
              <dd className="font-mono">{totalStats.talksWithSummary}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold">Summary Coverage</dt>
              <dd className="font-mono">
                {totalStats.totalTalks > 0
                  ? Math.round((totalStats.talksWithSummary / totalStats.totalTalks) * 100)
                  : 0}
                %
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">By Event</h2>
        <div className="space-y-4">
          {eventStats.map(({ event, stats }) => (
            <div key={event.slug} className="border border-slate-200 dark:border-slate-700 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">{event.name}</h3>
                <span className="text-sm text-slate-600 dark:text-slate-400">{event.year}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-slate-600 dark:text-slate-400">Total Talks</div>
                  <div className="font-mono font-bold">{stats.totalTalks}</div>
                </div>
                <div>
                  <div className="text-slate-600 dark:text-slate-400">With Summaries</div>
                  <div className="font-mono font-bold">{stats.talksWithSummary}</div>
                </div>
                <div>
                  <div className="text-slate-600 dark:text-slate-400">Coverage</div>
                  <div className="font-mono font-bold">{stats.summaryPercentage}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">By Village Edition</h2>
        <div className="space-y-3">
          {villageCoverage
            .sort((a, b) => b.edition.year - a.edition.year || a.edition.villageName.localeCompare(b.edition.villageName))
            .map(({ edition, stats }) => (
              <div
                key={edition.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700"
              >
                <div className="flex-1">
                  <Link
                    href={`/${edition.eventSlug}/${edition.villageSlug}`}
                    className="font-medium hover:underline"
                  >
                    {edition.villageName}
                  </Link>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {edition.eventShortName} {edition.year}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {stats.talksWithSummary}/{stats.totalTalks} ({stats.summaryPercentage}%)
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="mt-12 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-800">
        <h2 className="font-semibold mb-2">About Summaries</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Summaries that have been automatically generated from talk content are marked on the talk
          page. Hand-authored summaries are from our archive curators.
        </p>
      </section>
    </main>
  );
}
