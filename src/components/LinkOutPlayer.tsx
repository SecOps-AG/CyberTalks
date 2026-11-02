/**
 * Talks with no YouTube id. The stored frame is the poster; the file opens
 * on the DEF CON media server.
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
        <img
          src={thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
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
          This recording is not on YouTube. The button opens the file on the DEF CON media server.
        </p>
      </div>
    </div>
  );
}
