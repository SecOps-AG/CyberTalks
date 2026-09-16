import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel px-6 py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-2xl text-acid">Nothing at this address</h1>
      <p className="mt-3 text-sm text-mint/60">
        The talk, village, or topic you asked for is not in the archive.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/talks" className="chip">
          Browse talks
        </Link>
        <Link href="/villages" className="chip">
          Villages
        </Link>
      </div>
    </section>
  );
}
