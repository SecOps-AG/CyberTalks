import { siteUrl } from "./site-url";

/** Plain-text guide for language-model crawlers, served at /llms.txt. */
export function llmsTxt(origin: string = siteUrl()): string {
  return `# Cyber Talks

> Cyber Talks is a searchable archive of cybersecurity conference talks, with the recording where one is public and a short written summary of each talk.

Cyber Talks is an unofficial archive. It is not affiliated with, endorsed by, or an official source for DEF CON, Black Hat, BSides, RSA Conference, TROOPERS, or any other conference or organizer. Talk titles, speaker names, and recordings belong to their owners; the summaries are our own. For anything official, such as schedules, rules, or the authoritative recording, go to the conference itself.

## Sections

- [All talks](${origin}/): browse and filter the whole archive
- [Search](${origin}/search): keyword search with year, conference, track, topic, and difficulty filters
- [DEF CON](${origin}/defcon): DEF CON talks by edition
- [DEF CON villages](${origin}/defcon/villages): every DEF CON village across all years
- [Black Hat](${origin}/black-hat): Black Hat talks by edition
- [BSides](${origin}/bsides): BSides talks by edition
- [Tracks](${origin}/tracks): talks grouped by the kind of work they cover
- [Topics](${origin}/topics): talks grouped by subject
- [Speakers](${origin}/speakers): every speaker and the talks they gave

## Pages

- Each talk has its own page at ${origin}/talks/<slug>, with the player, a short summary, and links to slides or code when we have them.
- Each speaker has a page at ${origin}/speakers/<slug> listing their talks.

## Sitemap

- [Sitemap](${origin}/sitemap.xml): the indexable talk, speaker, track, and topic pages
`;
}
