import Link from "next/link";
import { DC34_BANNER } from "@/lib/dc34";

/** Slim announcement bar under the site header. Server-rendered, so it is in the first paint. */
export function SiteBanner() {
  return (
    <div className="border-b border-acid/20 bg-acid/5">
      <p className="mx-auto max-w-7xl px-4 py-1.5 text-[11px] text-mint/80 sm:px-6">
        {DC34_BANNER.text}{" "}
        <Link href={DC34_BANNER.href} className="link">
          {DC34_BANNER.linkLabel}
        </Link>
      </p>
    </div>
  );
}
