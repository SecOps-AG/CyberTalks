import Link from "next/link";
import { isDefconVillageTalk, villageSeriesPath } from "@/lib/hubs";
import { conferenceLabel, difficultyLabel, normalizeDifficulty } from "@/lib/labels";
import { isYouTubeId, thumbnailSrc } from "@/lib/materials";
import { formatDuration } from "@/lib/search";
import type { Difficulty, SearchEntry, TalkIndexEntry } from "@/lib/types";
import { BookmarkButton } from "@/components/BookmarkButton";

const MAX_TOPICS = 3;

/** Thumbnail badge colours, cool to hot as the level rises. */
const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  beginner: "border-cyan/50 text-cyan",
  intermediate: "border-acid/50 text-acid",
  advanced: "border-warn/60 text-warn",
  expert: "border-mag/60 text-mag",
};

/**
 * Cards take a TalkIndexEntry, or optionally a SearchEntry with matched summary info.
 */
export function TalkCard({
  talk,
  priority = false,
}: {
  talk: TalkIndexEntry | Partial<SearchEntry>;
  /** First on-screen card. Eager so it can be the LCP image. */
  priority?: boolean;
}) {
  const shown = (talk.topics ?? []).slice(0, MAX_TOPICS);
  const overflow = (talk.topics ?? []).length - shown.length;
  const duration = formatDuration(talk.durationSeconds);
  const language = talk.language?.toUpperCase();
  // An unclassified talk gets no badge and looks like it always has.
  const difficulty = normalizeDifficulty(talk.difficulty);
  const showVillageLink =
    talk.conference != null &&
    talk.eventSlug != null &&
    isDefconVillageTalk({ conference: talk.conference, eventSlug: talk.eventSlug });

  // Phones (<600px) get a compact row: small thumbnail, title, speakers, one line of facts.
  const compactFacts = [
    talk.eventShortName,
    difficulty ? difficultyLabel(difficulty) : null,
    duration,
  ].filter(Boolean);

  return (
    <article className="panel group flex h-full flex-col overflow-hidden transition hover:border-acid/50 max-[599px]:flex-row max-[599px]:gap-3 max-[599px]:p-2.5">
      <Link
        href={`/talks/${talk.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative block overflow-hidden bg-black max-[599px]:w-32 max-[599px]:shrink-0 max-[599px]:self-start"
      >
        <img
          src={talk.youtubeId ? thumbnailSrc(talk.youtubeId) : ""}
          // The compact phone thumbnail can use the smaller 16:9 image.
          srcSet={
            isYouTubeId(talk.youtubeId)
              ? `${thumbnailSrc(talk.youtubeId!, "mq")} 320w, ${thumbnailSrc(talk.youtubeId!)} 480w`
              : undefined
          }
          sizes={isYouTubeId(talk.youtubeId) ? "(max-width: 599px) 128px, 480px" : undefined}
          alt=""
          width={480}
          height={270}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          // 16:9 is set inline so the box exists before the stylesheet arrives.
          style={{ aspectRatio: "16 / 9", width: "100%", height: "auto" }}
          // A thumbnail request should not tell Google which talk page you are on.
          referrerPolicy="no-referrer"
          className="aspect-video w-full object-cover opacity-80 transition group-hover:opacity-100"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1 max-[599px]:hidden">
          {talk.kind && talk.kind !== "talk" ? (
            <span className="rounded-sm border border-cyan/40 bg-void/85 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan">
              {talk.kind}
            </span>
          ) : null}
          <span className="rounded-sm border border-acid/40 bg-void/85 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-acid">
            {talk.eventShortName}
          </span>
        </div>
        {difficulty ? (
          <span
            className={`absolute bottom-2 left-2 rounded-sm border bg-void/90 max-[599px]:hidden px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${DIFFICULTY_STYLES[difficulty]}`}
          >
            {difficultyLabel(difficulty)}
          </span>
        ) : null}
        {duration ? (
          <span className="absolute bottom-2 right-2 rounded-sm border border-mint/20 bg-void/90 max-[599px]:hidden px-1.5 py-0.5 font-mono text-[10px] text-mint/90">
            {duration}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4 max-[599px]:min-w-0 max-[599px]:gap-1.5 max-[599px]:p-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.16em] max-[599px]:hidden">
          {showVillageLink && talk.villageSlug ? (
            <Link href={villageSeriesPath(talk.villageSlug)} className="text-cyan hover:text-acid">
              {talk.villageName}
            </Link>
          ) : (
            <span className="text-cyan/90">{talk.villageName}</span>
          )}
          {duration ? (
            <>
              <span className="text-mint/25">·</span>
              <span className="text-mint/60">{duration}</span>
            </>
          ) : null}
        </p>

        {/* Static facts, each shown only when the data has it. Track is the one link. */}
        <ul aria-label="Talk details" className="flex flex-wrap gap-1.5 max-[599px]:hidden">
          {talk.conference ? (
            <li className="meta-chip border-acid/35 text-acid/90">{conferenceLabel(talk.conference)}</li>
          ) : null}
          {talk.track && talk.trackName ? (
            <li>
              <Link
                href={`/tracks/${talk.track}`}
                className="meta-chip border-mag/35 text-mag/90 hover:border-mag hover:text-acid"
              >
                {talk.trackName}
              </Link>
            </li>
          ) : null}
          {talk.dateLabel ? (
            <li className="meta-chip">
              <span className="sr-only">Date: </span>
              {talk.dateLabel}
            </li>
          ) : null}
          {talk.locationLabel ? (
            <li className="meta-chip">
              <span className="sr-only">Location: </span>
              {talk.locationLabel}
            </li>
          ) : null}
          {language ? (
            <li className="meta-chip border-cyan/30 text-cyan/85" title={`Language: ${language}`}>
              <span className="sr-only">Language: </span>
              {language}
            </li>
          ) : null}
        </ul>

        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-snug text-acid max-[599px]:text-[13px]">
            <Link href={`/talks/${talk.slug}`} className="hover:text-cyan">
              {talk.title}
            </Link>
          </h3>
          {talk.id ? <BookmarkButton talkId={talk.id} /> : null}
        </div>

        {(talk.speakers ?? []).length > 0 ? (
          <p className="text-xs text-mint/65">{(talk.speakers ?? []).join(" · ")}</p>
        ) : null}

        {compactFacts.length > 0 ? (
          <p className="hidden text-[11px] text-cyan/90 max-[599px]:block">
            {compactFacts.join(" · ")}
          </p>
        ) : null}

        {talk.teaser ? (
          <p className="text-sm leading-relaxed text-mint/85 max-[599px]:hidden">{talk.teaser}</p>
        ) : null}

        {(talk as Partial<SearchEntry>).matchedInSummary ? (
          <p className="text-xs text-cyan/75 italic">
            Matched in summary
          </p>
        ) : null}

        {shown.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1 max-[599px]:hidden">
            {shown.map((topic) => (
              <span key={topic} className="tag">
                {topic}
              </span>
            ))}
            {overflow > 0 ? <span className="tag border-transparent">+{overflow}</span> : null}
          </div>
        ) : (
          <div className="mt-auto" />
        )}
      </div>
    </article>
  );
}
