import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/SectionHeading";
import { TalkCard } from "@/components/TalkCard";
import { TalkSummaryPanel } from "@/components/TalkSummary";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { BookmarkButton } from "@/components/BookmarkButton";
import { WatchedMarker } from "@/components/WatchedMarker";
import { getTalkBySlug, getTalkIndex, getTalks, getTaxonomy } from "@/lib/data";
import { formatDuration, slugifySpeaker } from "@/lib/search";
import type { Talk } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

const RELATED = 3;

export function generateStaticParams() {
  return getTalks().map((talk) => ({ slug: talk.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const talk = getTalkBySlug(slug);
  if (!talk) return { title: "Talk not found" };

  const title = talk.title;
  const description =
    talk.teaser ||
    `${talk.speakers.join(", ")} — ${talk.villageName}, ${talk.eventName}.`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${talk.youtubeId}/hqdefault.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "video.other",
      images: [
        {
          url: thumbnailUrl,
          width: 480,
          height: 360,
          alt: talk.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [thumbnailUrl],
    },
  };
}

/** Shared topics first, then same track, then same village. */
function relatedTalks(talk: Talk) {
  const topics = new Set(talk.topics);
  return getTalks()
    .filter((other) => other.id !== talk.id)
    .map((other) => ({
      talk: other,
      score:
        other.topics.filter((topic) => topics.has(topic)).length * 3 +
        (other.track === talk.track ? 2 : 0) +
        (other.villageSlug === talk.villageSlug ? 1 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.talk.year - a.talk.year)
    .slice(0, RELATED)
    .map((entry) => entry.talk);
}

export default async function TalkPage({ params }: Props) {
  const { slug } = await params;
  const talk = getTalkBySlug(slug);
  if (!talk) notFound();

  const labels = getTaxonomy().topicLabels;
  const related = getTalkIndex(relatedTalks(talk));
  const duration = formatDuration(talk.durationSeconds);

  return (
    <article className="space-y-8">
      <nav aria-label="Breadcrumb" className="eyebrow flex flex-wrap items-center gap-2">
        <Link href={`/${talk.eventSlug}`} className="hover:text-acid">
          {talk.eventName}
        </Link>
        <span className="text-mint/25">/</span>
        <Link href={`/${talk.eventSlug}/${talk.villageSlug}`} className="hover:text-acid">
          {talk.villageName}
        </Link>
      </nav>

      <header className="space-y-4">
        <h1 className="max-w-4xl font-display text-2xl font-bold leading-tight tracking-[0.03em] text-acid sm:text-3xl">
          {talk.title}
        </h1>
        {talk.speakers.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mint/85">
            {talk.speakers.map((speaker, index) => {
              const slug = slugifySpeaker(speaker);
              return (
                <span key={`${speaker}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span aria-hidden className="text-mint/25">
                      ·
                    </span>
                  ) : null}
                  {/* A name with nothing sluggable in it has no page to link to. */}
                  {slug ? (
                    <Link
                      href={`/speakers/${slug}`}
                      className="underline decoration-acid/30 underline-offset-4 transition hover:text-cyan hover:decoration-cyan"
                    >
                      {speaker}
                    </Link>
                  ) : (
                    <span>{speaker}</span>
                  )}
                </span>
              );
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {talk.kind && talk.kind !== "talk" ? (
            <span className="chip !border-cyan/40 !text-cyan">
              {talk.kind}
            </span>
          ) : null}
          <Link href={`/tracks/${talk.track}`} className="chip">
            {talk.trackName}
          </Link>
          <Link href={`/villages/${talk.villageSlug}`} className="chip">
            {talk.villageName}
          </Link>
          {duration ? (
            <span className="chip !border-mint/30 !text-mint/80">
              {duration}
            </span>
          ) : null}
          <WatchedMarker talkId={talk.id} youtubeUrl={talk.youtubeUrl} />
          <BookmarkButton talkId={talk.id} variant="full" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-6">
          <YouTubeEmbed videoId={talk.youtubeId} title={talk.title} />
          {talk.teaser ? (
            <p className="border-l-2 border-acid/40 pl-4 text-base leading-relaxed text-mint">
              {talk.teaser}
            </p>
          ) : null}
          <TalkSummaryPanel talk={talk} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <section className="panel-quiet p-4">
            <p className="label mb-2">Where</p>
            <p className="text-[13px] leading-relaxed text-mint/80">
              {talk.villageName}
              <br />
              {talk.eventName}
            </p>
            {duration ? (
              <>
                <p className="label mb-2 mt-4">Duration</p>
                <p className="text-[13px] leading-relaxed text-mint/80">{duration}</p>
              </>
            ) : null}
          </section>
          {talk.topics.length > 0 ? (
            <section className="panel-quiet p-4">
              <p className="label mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {talk.topics.map((topic) => (
                  <Link
                    key={topic}
                    href={`/topics/${topic}`}
                    className="chip !normal-case !tracking-normal"
                  >
                    {labels[topic] ?? topic}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="pt-4">
          <SectionHeading title="Related talks" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((other) => (
              <TalkCard key={other.id} talk={other} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
