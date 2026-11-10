import { jsonLdString } from "@/lib/json-ld";

/** Structured data for crawlers. Takes one object or a list. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(item) }}
        />
      ))}
    </>
  );
}
