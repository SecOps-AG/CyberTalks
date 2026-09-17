import Link from "next/link";
import { isDefconVillageTalk, villageSeriesPath } from "@/lib/hubs";
import { conferenceLabel } from "@/lib/labels";
import { formatDuration } from "@/lib/search";
import type { SearchEntry, TalkIndexEntry } from "@/lib/types";
import { BookmarkButton } from "@/components/BookmarkButton";

const MAX_TOPICS = 3;

/**
 * Cards take a TalkIndexEntry, or optionally a SearchEntry with matched summary info.
 */
export function TalkCard({ talk }: { talk: TalkIndexEntry | Partial<SearchEntry> }) {
  const shown = (talk.topics ?? []).slice(0, MAX_TOPICS);
  const overflow = (talk.topics ?? []).length - shown.length;
  const duration = formatDuration(talk.durationSeconds);
  const language = talk.language?.toUpperCase();
  const showVillageLink =
    talk.conference != null &&
    talk.eventSlug != null &&
    isDefconVillageTalk({ conference: talk.conference, eventSlug: talk.eventSlug });

  return (
    <article className="panel group flex h-full flex-col overflow-hidden transition hover:border-acid/50">
      <Link
        href={`/talks/${talk.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative block overflow-hidden bg-black"
      >
        <img
          src={`https://i.ytimg.com/vi/${talk.youtubeId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          // A thumbnail request should not tell Google which talk page you are on.
          referrerPolicy="no-referrer"
          className="aspect-video w-full object-cover opacity-80 transition group-hover:opacity-100"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {talk.kind && talk.kind !== "talk" ? (
            <span className="rounded-sm border border-cyan/40 bg-void/85 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan">
              {talk.kind}
            </span>
          ) : null}
          <span className="rounded-sm border border-acid/40 bg-void/85 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-acid">
            {talk.eventShortName}
          </span>
        </div>
        {duration ? (
          <span className="absolute bottom-2 right-2 rounded-sm border border-mint/20 bg-void/90 px-1.5 py-0.5 font-mono text-[10px] text-mint/90">
            {duration}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.16em]">
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
        <ul aria-label="Talk details" className="flex flex-wrap gap-1.5">
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
          <h3 className="font-display text-base font-semibold leading-snug text-acid">
            <Link href={`/talks/${talk.slug}`} className="hover:text-cyan">
              {talk.title}
            </Link>
          </h3>
          {talk.id ? <BookmarkButton talkId={talk.id} /> : null}
        </div>

        {(talk.speakers ?? []).length > 0 ? (
          <p className="text-xs text-mint/65">{(talk.speakers ?? []).join(" · ")}</p>
        ) : null}

        {talk.teaser ? (
          <p className="text-sm leading-relaxed text-mint/85">{talk.teaser}</p>
        ) : null}

        {(talk as Partial<SearchEntry>).matchedInSummary ? (
          <p className="text-xs text-cyan/75 italic">
            Matched in summary
          </p>
        ) : null}

        {shown.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
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
