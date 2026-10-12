import Link from "next/link";

export function SectionHeading({
  title,
  hint,
  href,
  hrefLabel,
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-acid/15 pb-2">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-acid">
        {title}
      </h2>
      {hint ? <p className="text-[11px] text-mint/50">{hint}</p> : null}
      {href ? (
        <Link href={href} className="eyebrow hover:text-acid">
          {hrefLabel ?? "See all"} →
        </Link>
      ) : null}
    </div>
  );
}
