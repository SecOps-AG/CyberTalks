import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { HeroConferences } from "@/components/HeroConferences";
import { MostWatched } from "@/components/MostWatched";
import { TrackChart } from "@/components/TrackChart";
import { loadHome } from "@/lib/page-runtime";
import { topicLabels } from "@/lib/topic-labels";

const EXAMPLES = ["ransomware", "osint", "supply chain", "purple team"];

/**
 * Home is the browser. Not a hub that links to one: the first thing on the page
 * is a hero holding the masthead and the search field, then the filters and
 * talk grid, with the Most Watched rail and track chart below (hidden while
 * searching or filtering).
 *
 * The full talk catalog is loaded client-side from year shards (remoteIndex)
 * so the static HTML stays under Vercel's body-size limit.
 */
export default async function HomePage() {
  const { stats, conferences, mostWatched, trackCounts } = await loadHome();
  const masthead = (
    <header key="masthead" className="relative flex flex-col items-start text-left">
      <p className="eyebrow">Conference talk archive</p>
      <h1
        className="mt-2 font-display text-4xl font-bold tracking-[0.05em] sm:text-[3.25rem] sm:leading-tight pb-1 glitch"
        data-text="Cyber Talks"
      >
        Cyber Talks
      </h1>
      <HeroConferences
        talks={stats.talks}
        speakers={stats.speakers}
        conferences={conferences}
      />
    </header>
  );

  return (
    <TalkBrowser
      talks={[]}
      remoteIndex
      hide={["villages"]}
      alwaysShowDifficulties
      topicLabels={topicLabels()}
      masthead={masthead}
      hero
      footer={
        <>
          <MostWatched talks={mostWatched} />
          <TrackChart counts={trackCounts} />
        </>
      }
      size="lg"
      examples={EXAMPLES}
      emptyHint="No talks match these filters."
    />
  );
}
