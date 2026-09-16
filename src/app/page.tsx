import { TalkBrowser } from "@/components/browser/TalkBrowser";
import { getTalkIndex, getTaxonomy } from "@/lib/data";

const EXAMPLES = ["ransomware", "osint", "supply chain", "purple team"];

/**
 * Home is the browser. Not a hub that links to one: the first thing on the page
 * is the archive itself, framed by a masthead and entered through search.
 */
export default function HomePage() {
  const masthead = (
    <header key="masthead" className="relative pb-6 pt-4 flex flex-col items-start text-left">
      <h1 
        className="font-display text-4xl font-bold tracking-[0.05em] sm:text-[4rem] glitch" 
        data-text="DEFCON Talks Archive"
      >
        DEFCON Talks Archive
      </h1>
      <div className="mt-8 w-full h-px bg-gradient-to-r from-acid/45 via-acid/15 to-transparent" />
    </header>
  );

  return (
    <TalkBrowser
      talks={getTalkIndex()}
      topicLabels={getTaxonomy().topicLabels}
      masthead={masthead}
      size="lg"
      examples={EXAMPLES}
      emptyHint="No talks match these filters."
    />
  );
}
