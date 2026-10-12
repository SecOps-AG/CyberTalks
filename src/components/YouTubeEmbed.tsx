/**
 * Stock YouTube iframe. No click-to-play facade, no nocookie player.
 */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="panel overflow-hidden">
      <div className="relative aspect-video bg-black">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}
