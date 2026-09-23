/**
 * Fast client-side filter for junk strings credited as "speakers" in village JSON.
 * Mirrors talk-ingest `scripts/lib/speaker-name-class.mjs` heuristics — keep in sync.
 */
export type SpeakerNameLabel = "person" | "org" | "junk" | "unsure";

const KNOWN_ORGS = new Set([
  "red hat",
  "intel",
  "google",
  "ibm",
  "microsoft",
  "vmware",
  "huawei",
  "suse",
  "linaro",
  "collabora",
  "bootlin",
  "independent",
  "oracle",
  "cisco",
  "amazon",
  "aws",
  "apple",
  "meta",
  "facebook",
  "twitter",
  "qualcomm",
  "nvidia",
  "amd",
  "dell",
  "hp",
  "sap",
  "salesforce",
  "crowdstrike",
  "palo alto networks",
  "fortinet",
  "trend micro",
  "kaspersky",
  "mandiant",
  "fireeye",
  "rapid7",
  "tenable",
  "sentinelone",
  "proofpoint",
  "okta",
  "cloudflare",
  "akamai",
  "verizon",
  "att",
  "comcast",
  "webcast",
  "webinar",
  "quick look",
  "live every tuesday",
  "targeting ai",
  "it ops query",
  "lf live webinar",
  "rsac tv",
  "inc.",
  "inc",
  "llc",
  "ltd",
  "intel corporation",
  "customer stories",
  "enterprise apps unpacked",
  "live every friday",
  "konnoha group",
]);

const EVENT_WORD_RE =
  /\b(conference|webinar|webcast|symposium|summit|expo|bootcamp|workshop|meetup|livestream|live stream|quick look|keynote\s+series)\b/i;
const EVENT_NAME_RE =
  /\b(def\s*con|black\s*hat|rsa\b|owasp|appsec|ekoparty|bsides|hack\.?in\.?paris|layerone|first\b|code\s*blue|sector\b|bluehat|cansecwest|hardwear\.io|hitb\b|derbycon|shmoocon|thotcon|circlecitycon|wild\s*west\s*hackin|deepsec|troopers|recon\b|nullcon|root\s*con)\b/i;
const ORG_SUFFIX_RE =
  /\b(inc\.?|llc|ltd\.?|gmbh|corp\.?|corporation|company|co\.|foundation|institute|university|college|technologies|technology|systems|security|solutions|consulting|group|labs?)\b/i;
const TRAILING_ORG_TOKENS = new Set([
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "gmbh",
  "corp",
  "corp.",
  "corporation",
  "company",
  "co",
  "co.",
  "foundation",
  "institute",
  "university",
  "college",
  "technologies",
  "technology",
  "systems",
  "security",
  "solutions",
  "consulting",
  "group",
  "labs",
  "lab",
]);
const YEAR_ONLY_RE = /^(19|20)\d{2}$/;
const YEAR_IN_NAME_RE = /\b(19|20)\d{2}\b/;
const PERSON_TOKEN_RE = /^[\p{L}][\p{L}'’.-]*$/u;

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikePersonTokens(tokens: string[]): boolean {
  if (tokens.length < 2) return false;
  if (tokens.length > 5) return false;
  const personish = tokens.filter((token) => PERSON_TOKEN_RE.test(token));
  if (personish.length < 2) return false;
  const capitalised = tokens.filter((token) => /^[\p{Lu}]/u.test(token));
  return capitalised.length >= 2;
}

/** True when the string plausibly names a human presenter (heuristic, not LLM). */
export function looksLikePersonName(name: string): boolean {
  const trimmed = normalise(name);
  if (!trimmed) return false;
  const heuristic = classifySpeakerNameHeuristic(trimmed);
  return heuristic.label === "person";
}

/** Heuristic label for a credited speaker string. */
export function classifySpeakerNameHeuristic(name: string): {
  label: SpeakerNameLabel;
  reason: string;
} {
  const trimmed = normalise(name);
  if (!trimmed) return { label: "junk", reason: "empty" };
  if (trimmed.length === 1) return { label: "junk", reason: "single_char" };
  if (YEAR_ONLY_RE.test(trimmed)) return { label: "junk", reason: "year_only" };
  if (/^\d+$/.test(trimmed)) return { label: "junk", reason: "number_only" };

  const lower = trimmed.toLowerCase();
  if (KNOWN_ORGS.has(lower)) return { label: "org", reason: "known_org" };
  if (EVENT_NAME_RE.test(trimmed)) return { label: "org", reason: "event_name" };
  if (EVENT_WORD_RE.test(trimmed)) return { label: "org", reason: "event_word" };
  if (ORG_SUFFIX_RE.test(trimmed) && !looksLikePersonTokens(trimmed.split(/\s+/))) {
    return { label: "org", reason: "org_suffix" };
  }
  if (YEAR_IN_NAME_RE.test(trimmed) && !looksLikePersonTokens(trimmed.split(/\s+/))) {
    return { label: "org", reason: "year_in_event" };
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("@")) {
    return { label: "junk", reason: "url_or_email" };
  }
  if (/^[^a-zA-Z0-9]*$/.test(trimmed)) return { label: "junk", reason: "no_letters" };

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";
  if (tokens.length >= 2 && TRAILING_ORG_TOKENS.has(lastToken.toLowerCase())) {
    return { label: "org", reason: "trailing_org_word" };
  }
  if (looksLikePersonTokens(tokens)) return { label: "person", reason: "name_tokens" };

  // Single capitalised token — handle or ambiguous org (e.g. "CrowdStrike" without suffix).
  if (tokens.length === 1) {
    if (/^[\p{Lu}][\p{Ll}]+$/u.test(trimmed)) return { label: "unsure", reason: "single_proper" };
    if (/^[a-z][a-z0-9_-]{2,}$/.test(trimmed)) return { label: "unsure", reason: "handle" };
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 6) {
      return { label: "unsure", reason: "initials" };
    }
    return { label: "org", reason: "single_token" };
  }

  // Multi-word but not person-shaped — likely org or series title.
  if (tokens.length >= 2 && trimmed === trimmed.toUpperCase()) {
    return { label: "org", reason: "all_caps_phrase" };
  }

  return { label: "unsure", reason: "ambiguous" };
}

export function isLikelyPersonSpeaker(name: string): boolean {
  const { label } = classifySpeakerNameHeuristic(name);
  return label === "person";
}
