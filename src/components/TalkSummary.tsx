import type { Talk, TalkSummary } from "@/lib/types";

/**
 * Summaries arrive as one long string of blank-line-separated blocks. Short
 * blocks with no terminal punctuation are section headings in practice, so we
 * promote them instead of rendering a 4 KB wall of paragraphs.
 */
function isHeading(block: string): boolean {
  const text = block.trim();
  return text.length < 90 && text.split(/\s+/).length <= 12 && !/[.?!,;]$/.test(text);
}

const LEAD_IN = /^([A-Z][^:]{2,44}):\s+([\s\S]+)$/;
const TIMESTAMP_REGEX = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g;

function linkifyTimestamps(text: string, youtubeUrl?: string): React.ReactNode {
  if (!youtubeUrl) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(TIMESTAMP_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const timestamp = match[0];
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    const sep = youtubeUrl.includes("?") ? "&" : "?";
    const href = `${youtubeUrl}${sep}t=${totalSeconds}s`;

    parts.push(
      <a
        key={`${match.index}-${timestamp}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-cyan underline underline-offset-2 hover:text-acid"
      >
        {timestamp}
      </a>,
    );

    lastIndex = match.index + timestamp.length;
  }

  if (lastIndex === 0) return text;

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function ProseBlocks({ text, youtubeUrl }: { text: string; youtubeUrl?: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (isHeading(block)) {
          return (
            <h3
              key={index}
              className="pt-2 font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-cyan"
            >
              {block}
            </h3>
          );
        }
        const lead = block.match(LEAD_IN);
        if (lead) {
          return (
            <p key={index} className="text-[15px] leading-relaxed text-mint/90">
              <strong className="font-semibold text-acid">{lead[1]}: </strong>
              {linkifyTimestamps(lead[2], youtubeUrl)}
            </p>
          );
        }
        return (
          <p key={index} className="text-[15px] leading-relaxed text-mint/90">
            {linkifyTimestamps(block, youtubeUrl)}
          </p>
        );
      })}
    </div>
  );
}

export function TalkSummaryPanel({ talk }: { talk: Talk }) {
  const summary = talk.summary;

  if (summary == null || summary === "") {
    return (
      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-acid">Summary</h2>
        <p className="mt-3 text-sm text-mint/50">
          No summary yet — watch the video above, or open it on YouTube.
        </p>
      </section>
    );
  }

  if (typeof summary === "string") {
    return (
      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 border-b border-acid/15 pb-2 font-display text-sm uppercase tracking-[0.2em] text-acid">
          Summary
        </h2>
        <ProseBlocks text={summary} youtubeUrl={talk.youtubeUrl} />
      </section>
    );
  }

  const structured = summary as TalkSummary;
  const extras = Object.entries(structured).filter(
    ([key]) => !["overview", "bullets", "takeaways"].includes(key),
  );

  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="mb-4 border-b border-acid/15 pb-2 font-display text-sm uppercase tracking-[0.2em] text-acid">
        Summary
      </h2>
      {structured.overview ? (
        <ProseBlocks text={structured.overview} youtubeUrl={talk.youtubeUrl} />
      ) : null}
      {Array.isArray(structured.bullets) && structured.bullets.length > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-mint/90">
          {structured.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(structured.takeaways) && structured.takeaways.length > 0 ? (
        <>
          <h3 className="pt-5 font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-cyan">
            Takeaways
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-mint/90">
            {structured.takeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      {!structured.overview && !structured.bullets && !structured.takeaways && extras.length > 0 ? (
        <pre className="mt-4 overflow-x-auto text-xs text-mint/70">
          {JSON.stringify(structured, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
