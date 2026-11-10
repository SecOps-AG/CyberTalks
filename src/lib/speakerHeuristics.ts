/**
 * Fast filter for junk strings credited as "speakers" in village JSON.
 *
 * The base rules mirror the ingest-side name classifier. The "title-like" rules
 * further down are site-side additions: a credit that reads like a talk title
 * (stop words, topic nouns, gerund openers) is not a person and gets no
 * speaker page. Pure and stateless, so it runs on the server, in the build,
 * and in the browser.
 */
import { SPEAKER_INDEX_MIN } from "./indexability";

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

/** Words that start or glue a talk title together; names do not contain them. */
const STOP_WORDS = new Set([
  "of", "the", "and", "for", "in", "on", "at", "to", "with", "from", "is", "are", "how",
  "why", "what", "when", "where", "who", "vs", "via", "into", "your", "our", "my", "you",
  "we", "using", "about", "through", "or", "as", "by", "not", "be", "can", "it", "its",
  "this", "that", "these", "those", "an", "a", "und", "para", "con", "los", "las", "una", "por",
]);

/** Topic nouns, role words and series words that appear in titles but not in names. */
const TITLE_WORDS = new Set([
  "security", "cybersecurity", "cyber", "hacking", "hacker", "hackers", "hack", "hacks",
  "attack", "attacks", "attacking", "threat", "threats", "malware", "ransomware", "phishing",
  "exploit", "exploits", "exploiting", "exploitation", "vulnerability", "vulnerabilities",
  "cloud", "data", "network", "networks", "networking", "system", "systems", "software",
  "hardware", "firmware", "kernel", "code", "web", "mobile", "wireless", "iot", "embedded",
  "device", "devices", "infrastructure", "platform", "framework", "application", "applications",
  "apps", "app", "api", "dns", "crypto", "cryptography", "encryption", "blockchain", "privacy",
  "identity", "authentication", "forensics", "intelligence", "analysis", "analytics",
  "detection", "response", "incident", "risk", "compliance", "policy", "governance",
  "management", "engineering", "development", "devops", "devsecops", "opsec", "infosec",
  "appsec", "osint", "automation", "automated", "advanced", "modern", "practical", "ultimate",
  "accelerated", "innovation", "technology", "technologies", "research", "design",
  "architecture", "performance", "testing", "fuzzing", "reverse", "defense", "offensive",
  "trends", "trend", "future", "lessons", "challenge", "challenges", "introduction",
  "overview", "workshop", "keynote", "panel", "webinar", "webcast", "session", "sessions",
  "talk", "talks", "interview", "interviews", "welcome", "closing", "ceremony", "ceremonies",
  "awards", "village", "conference", "summit", "episode", "podcast", "tutorial", "demo",
  "tools", "tool", "techniques", "strategies", "strategy", "solutions", "services",
  "service", "enterprise", "business", "industry", "community", "foundation", "project",
  "projects", "program", "programs", "consultant", "independent", "researcher", "founder",
  "ceo", "cto", "ciso", "engineer", "developer", "developers", "director", "manager", "team",
  "presenter", "speaker", "speakers", "internet", "digital", "virtual", "online", "global",
  "open", "source", "supply", "chain", "zero", "trust", "machine", "learning", "deep",
  "smart", "critical", "physical", "social", "linux", "windows",
  "android", "kubernetes", "container", "containers", "aws", "azure", "google",
  "amazon", "microsoft", "facebook", "twitter", "instagram", "alexa", "ctf", "bounty",
  "big", "going", "dark", "token", "tokens", "memory", "stack", "protocol", "protocols",
  "monitoring", "protection", "resilience", "safety", "surveillance", "bypass",
  "injection", "impersonation", "takeover", "takeovers", "backdoor", "backdooring",
  "ai", "ml", "uk", "usa", "eu", "tv", "notebook", "notebooks", "teaming", "debate", "mitre", "rootkit", "rootkits", "botnet", "botnets", "honeypot", "honeynet", "fabric",
]);

/**
 * Words that open a talk title but are not given names. Checked on the first
 * word only, so a surname that happens to be an English word is not caught.
 */
const LEADING_TITLE_WORDS = new Set([
  "new", "building", "breaking", "real", "next", "time", "state", "world", "look", "hunting",
  "approach", "guide", "use", "journey", "information", "model", "models", "multi", "video",
  "generation", "life", "things", "inside", "sandbox", "computing", "better", "distributed",
  "human", "impact", "update", "safe", "level", "malicious", "study", "execution", "language",
  "edition", "quantum", "behind", "practices", "active", "large", "tips", "secrets", "apt",
  "server", "stop", "product", "report", "low", "center", "breach", "free", "showcase",
  "private", "teams", "serverless", "fast", "domain", "change", "people", "llm", "standards",
  "news", "adversary", "generative", "technical", "full", "easy", "discovery", "history",
  "culture", "sharing", "targeting", "intro", "practice", "reality", "before", "search",
  "directory", "adversarial", "storage", "transformation", "password", "database", "binary",
  "hard", "production", "great", "ways", "speed", "after", "root", "context", "compromise",
  "old", "mentorship", "energy", "national", "keys", "radio", "value", "engine", "experience",
  "problem", "tales", "corporate", "secret", "confidential", "mode", "health", "reversing",
  "pipeline", "today", "runtime", "trusted", "privilege", "graph", "matters", "features",
  "delivery", "forensic", "office", "healthcare", "international", "fault", "flow",
  "cybercrime", "rules", "client", "create", "hardening", "autonomous", "operational",
  "measuring", "fix", "start", "games", "flash", "evasion", "tricks", "patterns", "scanning",
  "three", "targeted", "command", "customer", "deception", "quality", "escalation", "steps",
  "anatomy", "cases", "vulnerable", "current", "never", "leadership", "log", "mesh", "every",
  "chains", "passwords", "hijacking", "crisis", "insurance", "class", "show", "link",
  "solution", "covert", "encrypted", "labs", "operation", "attacker", "channels", "content",
  "vendor", "third", "race", "email", "executive", "broken", "neural", "novel", "sql",
  "aware", "leading", "opportunities", "lines", "catch", "hiding", "grade", "events",
  "firewall", "coding", "functional", "fail", "approaches", "saas", "recent", "avoid", "ask",
  "explained", "crime", "startup", "expert", "communications", "unified", "manage", "mining",
  "universal", "capabilities", "migration", "vehicles", "write", "latest", "pandemic",
  "persistent", "shell", "hype", "escape", "voice", "strategic", "analyst", "warfare",
  "backdoors", "decentralized", "invisible", "style", "actions", "intelligent", "spoofing",
  "packet", "pitfalls", "battle", "magic", "insecure", "micro", "sustainable", "resource",
  "extensions", "movement", "growth", "pentest", "audio", "million", "timing", "functions",
  "walkthrough", "changes", "avoiding", "logging", "primer", "launch", "files", "prompt",
  "reactive", "feature", "lifecycle", "exposure", "managed", "dependencies", "paths", "types",
  "poisoning", "perfect", "informed", "metadata", "patching", "special", "function", "check",
  "interface", "alert", "professionals", "policies", "robot", "examples", "routing", "request",
  "internals", "toward", "towards", "bias", "takeaways", "scripting", "component", "silent",
  "documentation", "enhanced", "crash", "connectivity", "securely", "mission", "planning",
  "connect", "enterprises", "symbolic", "foundations", "defenders", "learnings", "actionable",
  "initial", "tradecraft", "computers", "contest", "resources", "pattern", "finance", "false",
  "engagement", "shells", "offense", "version", "leakage", "idea", "buffer", "trustworthy",
  "visual", "gaps", "operator", "careers", "deploy", "payload", "reports", "telemetry",
  "quest", "deterministic", "weapon", "convergence", "massive", "climate", "forget",
  "syndrome", "streams", "compute", "advances", "studio", "controlled", "sourcing", "overflow",
  "default", "structured", "verified", "filtering", "predictive", "records", "impacts",
  "picking", "manufacturing", "prototype", "containerized", "acceleration", "certified",
  "audits", "household", "agilely", "pseudorandom", "powitanie", "europejska", "half",
  "user", "vr", "apache", "voidlink", "linux", "kernel", "open", "private", "public",
]);

/** Words that close a talk title; a surname is very unlikely to be one of them. */
const TRAILING_TITLE_WORDS = new Set([
  "experience", "internals", "numbers", "measures", "wiring", "camel", "insecure", "compliant",
  "trustworthy", "yourself", "uncle", "set", "features", "practices", "basics", "essentials",
  "fundamentals", "explained", "revisited", "reloaded", "unleashed", "demystified", "101",
  "walkthrough", "roadmap", "update", "updates", "review", "recap", "keynote", "showcase",
  "pitch", "challenge", "competition", "debate", "discussion", "overview", "workshop",
  "masterclass", "presentation", "recording", "interview", "livestream", "stream", "notebooks",
  "story", "stories", "lab", "labs", "tracks", "track", "stage", "room", "hall",
]);

/** Name particles that may be lower case inside a real name. */
const NAME_PARTICLES = new Set([
  "de", "del", "della", "di", "da", "dos", "das", "du", "van", "von", "der", "den", "la",
  "le", "el", "al", "bin", "ibn", "ben", "ter", "ten", "st",
]);

const GERUND_FIRST_WORD_EXCEPTIONS = new Set([
  "sterling", "irving", "stirling", "darling", "harding", "manning", "fleming", "browning",
  "channing", "whiting", "kipling", "ewing", "bunting", "dowling", "sebring",
]);
const TITLE_NOUN_SUFFIXES: [string, number][] = [
  ["tion", 8], ["sion", 8], ["ment", 9], ["ity", 8], ["ness", 7], ["ware", 6],
  ["ics", 6], ["ogy", 6], ["ysis", 6], ["ability", 8],
];

/** Mixed phrases and symbols that never occur inside a person's name. */
const NON_NAME_CHARS_RE = /[\d:,;/\\#@!?=+*_~<>{}[\]()&"“”]|\.{2,}|…/;

function foldKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The name as it should read on a page. Drops a trailing "| Event" credit
 * ("Matteo Rebeschini | CypherCon 6.0"), a trailing country tag ("[PL]"), and
 * stray punctuation. It never adds or invents words.
 */
export function cleanSpeakerName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  const pipe = name.search(/\s*[|｜]\s*/);
  if (pipe > 0) name = name.slice(0, pipe).trim();
  name = name.replace(/\s*[[(]\s*[A-Za-z]{2,3}\s*[\])]\s*$/, "").trim();
  name = name.replace(/^[\s"'“”‘’.,;:-]+|[\s"'“”‘’,;:-]+$/g, "").trim();
  return name;
}

export type SpeakerPageContext = {
  title?: string;
  eventName?: string;
  villageName?: string;
  eventLabel?: string;
};

export type SpeakerVerdict = { ok: boolean; name: string; reason: string };

export type SpeakerVerdictOptions = {
  /**
   * How many talks credit this one-word name (see `speaker-credits.ts`). A
   * single-word credit is a handle or a first name and only gets a page once
   * it clearly recurs; every other rule still applies.
   */
  oneWordTalks?: number;
};

/** Heuristic reasons that mean "a single token that looks like a handle or a name". */
const ONE_WORD_REASONS = new Set(["single_proper", "handle", "initials", "single_token"]);

/**
 * One-word credits that recur on several talks but name a label, a company,
 * a product or an event series rather than a person. Found by reading every
 * one-word credit with 2+ talks; extend it when a new one turns up.
 */
const ONE_WORD_DENY = new Set([
  "unknown", "various", "tba", "tbd", "tbc", "staff", "hallway", "anonymous", "everyone",
  "multiple", "panelists", "moderator", "organizers", "organisers", "attendees", "admin",
  "host", "guest", "guests", "none", "other", "others", "misc", "volunteers", "sponsor",
  "sponsors", "undisclosed", "friends", "phd", "wwhf", "rs", "inse", "pni",
  "scapy", "linumiz", "citrinio", "kong", "edera", "komodor", "aiven", "kusari", "profian",
  "ck", "fs", "nirmata", "zededa", "daynix", "aikidev", "caido", "fortimonitor", "sensepost", "biascilab",
]);

/** The reason a credited string reads like a title or label, or null when it reads like a name. */
function titleLikeReason(name: string): string | null {
  if (NON_NAME_CHARS_RE.test(name)) return "punctuation_or_digits";
  const tokens = name.split(/\s+/);
  if (tokens.length > 5) return "too_many_words";
  if (tokens.length === 5 && !tokens.some((token) => NAME_PARTICLES.has(token.toLowerCase()))) {
    return "too_many_words";
  }
  for (const token of tokens) {
    const lower = token.toLowerCase().replace(/\.$/, "");
    if (STOP_WORDS.has(lower) && !(lower === "a" && token === "A")) return "stop_word";
    if (TITLE_WORDS.has(lower)) return "title_word";
    if (/^[\p{Lu}]{2,}s$/u.test(token)) return "plural_acronym";
    if (tokens.length >= 2 && /^\p{Ll}/u.test(token) && !NAME_PARTICLES.has(lower)) return "lowercase_word";
    if (/\p{L}Con$/u.test(token)) return "event_name";
  }
  if (tokens.length >= 2) {
    const first = tokens[0].toLowerCase();
    if (LEADING_TITLE_WORDS.has(first)) return "title_opening";
    if (TRAILING_TITLE_WORDS.has(tokens[tokens.length - 1].toLowerCase())) return "title_closing";
    if (tokens.some((token) => /['’]s$/i.test(token) && token.length > 3)) return "possessive_phrase";
    if (first.length >= 5 && first.endsWith("ing") && !GERUND_FIRST_WORD_EXCEPTIONS.has(first)) {
      return "gerund_opening";
    }
    const last = tokens[tokens.length - 1].toLowerCase();
    for (const [suffix, minLength] of TITLE_NOUN_SUFFIXES) {
      if (last.length >= minLength && last.endsWith(suffix)) return "title_noun_ending";
    }
    const mixedCase = tokens.some((token) => /\p{Ll}/u.test(token));
    if (mixedCase && tokens.some((token) => /^[\p{Lu}]{4,}$/u.test(token))) return "acronym_in_phrase";
  }
  return null;
}

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

  const titleLike = titleLikeReason(trimmed);
  if (titleLike) return { label: "junk", reason: titleLike };

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

/**
 * Whether a credited string gets its own speaker page. `ctx` is the talk it
 * was credited on: a credit equal to that talk's title, event or village name
 * is a mis-parsed field, not a person. The returned `name` is the cleaned
 * display name; it is only meaningful when `ok` is true.
 */
export function speakerPageVerdict(
  raw: string,
  ctx: SpeakerPageContext = {},
  options: SpeakerVerdictOptions = {},
): SpeakerVerdict {
  const name = cleanSpeakerName(raw);
  if (!name) return { ok: false, name, reason: "empty" };

  const key = foldKey(name);
  for (const field of [ctx.title, ctx.eventName, ctx.villageName, ctx.eventLabel]) {
    if (!field) continue;
    const other = foldKey(field);
    if (!other) continue;
    if (key === other) return { ok: false, name, reason: "matches_talk_field" };
  }

  const { label, reason } = classifySpeakerNameHeuristic(name);
  if (label === "person") return { ok: true, name, reason: "person" };
  if (ONE_WORD_REASONS.has(reason) && !ONE_WORD_DENY.has(name.toLowerCase())) {
    if ((options.oneWordTalks ?? 0) >= SPEAKER_INDEX_MIN) return { ok: true, name, reason: "one_word_repeat" };
    return { ok: false, name, reason: "one_word_single_talk" };
  }
  return { ok: false, name, reason };
}

export function isSpeakerPageName(
  raw: string,
  ctx: SpeakerPageContext = {},
  options: SpeakerVerdictOptions = {},
): boolean {
  return speakerPageVerdict(raw, ctx, options).ok;
}
