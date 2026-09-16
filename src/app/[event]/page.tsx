import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/SectionHeading";
import { TalkBrowser } from "@/components/browser/TalkBrowser";
import {
  getEditionsForEvent,
  getEvent,
  getEvents,
  getTalkIndex,
  getTalks,
  getTaxonomy,
} from "@/lib/data";

type Props = { params: Promise<{ event: string }> };

export function generateStaticParams() {
  return getEvents().map((event) => ({ event: event.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { event: eventSlug } = await params;
  const event = getEvent(eventSlug);
  if (!event) return { title: "Event not found" };
  return {
    title: event.name,
    description: `${event.name} village talks — ${event.dates}, ${event.location}.`,
  };
}

export default async function EventPage({ params }: Props) {
  const { event: eventSlug } = await params;
  const event = getEvent(eventSlug);
  if (!event) notFound();

  const editions = getEditionsForEvent(event.slug);
  const talks = getTalkIndex(getTalks().filter((talk) => talk.eventSlug === event.slug));

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="eyebrow">{event.dates} · {event.location}</p>
        <h1 className="font-display text-3xl font-bold tracking-[0.05em] text-acid">
          {event.name}
        </h1>
        <p className="text-sm text-mint/60">
          {editions.length} village{editions.length === 1 ? "" : "s"} · {talks.length} talks
        </p>
      </header>

      <section>
        <SectionHeading title="Villages at this event" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {editions.map((edition) => (
            <Link
              key={edition.id}
              href={`/${edition.eventSlug}/${edition.villageSlug}`}
              className="panel group flex flex-col gap-2 p-5 transition hover:border-acid/50"
            >
              <p className="font-display text-base font-semibold text-acid group-hover:text-cyan">
                {edition.villageName}
              </p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mint/50">
                {edition.talkCount} talks
              </p>
              <p className="line-clamp-3 pt-1 text-sm leading-relaxed text-mint/70">
                {edition.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title={`All ${event.shortName} talks`} />
        <TalkBrowser
          talks={talks}
          hide={["years"]}
          topicLabels={getTaxonomy().topicLabels}
          emptyHint={`No ${event.name} talks match these filters.`}
        />
      </section>
    </div>
  );
}
