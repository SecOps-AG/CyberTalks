import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { HeroConferences } from "@/components/HeroConferences";
import { MostWatched } from "@/components/MostWatched";
import { TrackChart } from "@/components/TrackChart";
import {
  getConferenceCounts,
  getMostWatched,
  getStats,
  getTaxonomy,
  getTrackCounts,
} from "@/lib/data";

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
export default function HomePage() {
  const stats = getStats();
  const conferences = getConferenceCounts();
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
      topicLabels={getTaxonomy().topicLabels}
      masthead={masthead}
      hero
      footer={
        <>
          <MostWatched talks={getMostWatched(12)} />
          <TrackChart counts={getTrackCounts()} />
        </>
      }
      size="lg"
      examples={EXAMPLES}
      emptyHint="No talks match these filters."
    />
  );
}
