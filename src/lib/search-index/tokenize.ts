/**
 * Word tokenizer shared by the index build and query parser.
 *
 * Matches are whole words, not substrings. Function words are dropped so a
 * teaser full of "the" and "and" does not bloat the postings or block a query.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "from",
  "by", "at", "as", "is", "are", "was", "were", "be", "been", "being", "it",
  "its", "this", "that", "these", "those", "we", "you", "your", "our", "their",
  "they", "them", "he", "she", "his", "her", "not", "but", "if", "than", "then",
  "so", "into", "over", "under", "about", "after", "before", "between", "through",
  "during", "without", "within", "also", "can", "may", "will", "just", "via",
  "per", "how", "what", "when", "where", "who", "which", "why", "have", "has",
  "had", "using", "use", "used", "new", "one", "two", "across", "such", "other",
  "more", "most", "any", "all",
]);

export function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Unique content tokens from one field, in first-seen order. */
export function tokensOf(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of normalizeText(value).split(/[^a-z0-9]+/)) {
    if (part.length < 2 || STOPWORDS.has(part) || seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}
