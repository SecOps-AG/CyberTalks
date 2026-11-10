import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { SectionHeading } from "@/components/SectionHeading";
import { TalkCard } from "@/components/TalkCard";
import { TalkSummaryPanel } from "@/components/TalkSummary";
import { LinkOutPlayer } from "@/components/LinkOutPlayer";
import { MaterialsList } from "@/components/MaterialsList";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { BookmarkButton } from "@/components/BookmarkButton";
import { WatchedMarker } from "@/components/WatchedMarker";
import { WatchedButton } from "@/components/WatchedButton";
import titleIndex from "@/generated/talk-titles.json";
import { loadTalk } from "@/lib/catalog-runtime";
import { canonicalUrl } from "@/lib/canonical";
import { talkDescription, talkJsonLd } from "@/lib/json-ld";
import { isDefconVillageTalk, villageEditionPath, villageSeriesPath } from "@/lib/hubs";
import { difficultyLabel, normalizeDifficulty } from "@/lib/labels";
import { isYouTubeId, publicMaterialBands, thumbnailSrc } from "@/lib/materials";
import { formatDuration, slugifySpeaker } from "@/lib/search";
import { siteUrl } from "@/lib/site-url";
import { talkDocumentTitle, type TitleIndex } from "@/lib/talk-title";
import { topicLabels } from "@/lib/topic-labels";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const record = await loadTalk(slug);
  const talk = record?.talk;
  if (!talk) return { title: "Talk not found" };

  const title = talkDocumentTitle(
    {
      title: talk.title,
      eventName: talk.eventName,
      year: talk.year,
      villageName: talk.villageName,
      speakers: talk.speakers,
      slug: talk.slug,
    },
    titleIndex as TitleIndex,
  );
  const description = talkDescription(talk);
  const talkUrl = canonicalUrl(`/talks/${encodeURIComponent(slug)}`);
  const thumb = thumbnailSrc(talk.youtubeId);
  const thumbnailUrl = thumb.startsWith("/") ? `${siteUrl()}${thumb}` : thumb;

  return {
    title,
    description,
    alternates: { canonical: talkUrl },
    openGraph: {
      title,
      description,
      url: talkUrl,
      siteName: "Cyber Talks",
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

export default async function TalkPage({ params }: Props) {
  const { slug } = await params;
  const record = await loadTalk(slug);
  if (!record) notFound();
  const { talk, related } = record;

  const labels = topicLabels();
  const duration = formatDuration(talk.durationSeconds);
  const difficulty = normalizeDifficulty(talk.difficulty);
  const youtube = isYouTubeId(talk.youtubeId);
  const bands = publicMaterialBands(talk.materials);
  const hasTopics = talk.topics.length > 0;

  return (
    <article className="space-y-8">
      <JsonLd data={talkJsonLd(talk)} />
      <nav aria-label="Breadcrumb" className="eyebrow flex flex-wrap items-center gap-2">
        <Link href={`/${talk.eventSlug}`} className="hover:text-acid">
          {talk.eventName}
        </Link>
        <span className="text-mint/25">/</span>
        <Link
          href={
            isDefconVillageTalk(talk)
              ? villageEditionPath(talk)
              : `/${talk.eventSlug}/${talk.villageSlug}`
          }
          className="hover:text-acid"
        >
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
          {talk.track ? (
            <Link href={`/tracks/${talk.track}`} className="chip">
              {talk.trackName}
            </Link>
          ) : null}
          {isDefconVillageTalk(talk) ? (
            <Link href={villageSeriesPath(talk.villageSlug)} className="chip">
              {talk.villageName}
            </Link>
          ) : (
            <span className="chip !cursor-default">{talk.villageName}</span>
          )}
          {duration ? (
            <span className="chip !border-mint/30 !text-mint/80">
              {duration}
            </span>
          ) : null}
          {difficulty ? (
            <Link href={`/?difficulty=${difficulty}`} className="chip" title="Difficulty">
              {difficultyLabel(difficulty)}
            </Link>
          ) : null}
          {youtube ? <WatchedMarker talkId={talk.id} youtubeUrl={talk.youtubeUrl} /> : null}
          <WatchedButton talkId={talk.id} youtubeId={talk.youtubeId || undefined} />
          <BookmarkButton talkId={talk.id} variant="full" />
        </div>
      </header>

      {youtube ? (
        <YouTubeEmbed videoId={talk.youtubeId} title={talk.title} />
      ) : talk.mediaUrl ? (
        <LinkOutPlayer thumbnailSrc={thumbnailSrc(talk.youtubeId)} mediaUrl={talk.mediaUrl} />
      ) : null}

      <section
        aria-label="Talk facts"
        className={`panel-quiet grid grid-cols-2 ${hasTopics ? "lg:grid-cols-4" : ""}`}
      >
        <div className={`border-r border-acid/15 p-4 ${hasTopics ? "border-b lg:border-b-0" : ""}`}>
          <p className="label mb-2">Where</p>
          <p className="text-[13px] leading-relaxed text-mint/80">
            {talk.villageName}
            <br />
            {talk.eventName}
          </p>
        </div>
        <div className={`border-acid/15 p-4 ${hasTopics ? "border-b lg:border-b-0 lg:border-r" : ""}`}>
          <p className="label mb-2">Duration</p>
          <p className="text-[13px] leading-relaxed text-mint/80">{duration || "—"}</p>
        </div>
        {hasTopics ? (
          <div className="col-span-2 p-4">
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
          </div>
        ) : null}
      </section>

      <div className="max-w-4xl space-y-6">
        {talk.teaser ? (
          <p className="border-l-2 border-acid/40 pl-4 text-base leading-relaxed text-mint">
            {talk.teaser}
          </p>
        ) : null}
        <TalkSummaryPanel talk={talk} />
        <MaterialsList materials={bands.materials} moreMaterials={bands.moreMaterials} />
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
