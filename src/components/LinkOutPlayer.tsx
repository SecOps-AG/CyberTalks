/**
 * Talks with no YouTube id. The official mp4 plays in place from the DEF CON
 * media server, with the stored frame as the poster and a link to the file.
 */
export function LinkOutPlayer({
  thumbnailSrc,
  mediaUrl,
}: {
  thumbnailSrc: string;
  mediaUrl: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video
          src={mediaUrl}
          poster={thumbnailSrc}
          controls
          preload="none"
          playsInline
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      </div>
      <div className="border-t border-acid/20 p-4">
        <a
          href={mediaUrl}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-acid/50 bg-acid/10 px-4 py-2 text-center text-sm font-medium uppercase tracking-[0.14em] text-acid transition hover:bg-acid/20 sm:w-auto"
        >
          Watch on DEF CON media
        </a>
        <p className="mt-2 text-[12px] leading-relaxed text-mint/55">
          This recording is not on YouTube. It plays from the DEF CON media server; the button opens the file there.
        </p>
      </div>
    </div>
  );
}
