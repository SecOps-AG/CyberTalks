# Architecture

## Information architecture

Five axes, each with its own home, so no single page has to carry everything:

| Axis | Cardinality | Where it lives |
| --- | --- | --- |
| **Event** (year) | one per DEF CON | `/<event>`, and the year facet on `/` |
| **Village** | tens, repeating yearly | `/villages`, `/villages/<village>` across years, `/<event>/<village>` for one year |
| **Track** | fixed vocabulary of 20 | `/tracks`, `/tracks/<track>` |
| **Topic** | thousands, growing | `/topics`, `/topics/<topic>` — never on top of another page |
| **Speaker** | one per credited name | `/speakers`, `/speakers/<speaker>` |
| Full-text | — | `/`, deep-linkable via `?q=` |

## Home is the browser

`/` is not a hub that links to the archive — it *is* the archive: a masthead
(counts, one line of framing), then the search field, then the same faceted
browser every other listing page uses. There is no browse-by-year grid, no track
row, and no "latest talks" strip, because each was a second, worse way to reach
what the facet rail already does, and each grew or went stale as the archive did.

`/talks` redirects to `/` with its query string intact, so links shared from the
old address still land filtered.

A **village** is the village itself (Recon Village), tracked across every year it
ran. A village at one event is an **edition**. A **track** is a fixed category of
work; a **topic** is a free-form fine-grained tag, several per talk.

## Why topics are not chips on the homepage

1,548 distinct topics across 1,103 talks — five per talk, and about 1.4 of them
new. The vocabulary grows close to linearly with the archive, so a chip wall is
unscannable at any size worth having. Topics appear only as:

- at most three per card, as static metadata
- a type-ahead plus the eight topics that co-occur with the current results, in
  the filter rail
- their own index at `/topics`, sorted by count and filterable
- links on a talk page

Tracks carry the "browse by category" job instead, because their vocabulary is
bounded by `data/taxonomy.json`.

## Data model

```
data/
  events.json                        DEF CONs: slug, name, year, dates, location
  taxonomy.json                      track vocabulary + topic display labels
  villages/
    defcon-33-recon-village.json     one village at one event, with its talks
    defcon-33-adversary-village.json
  raw/                               gitignored yt-dlp dumps
```

One file per village edition, discovered by `fs.readdirSync` in
`src/lib/data.ts`. Adding a village is dropping in a JSON file — no code change,
no line to append to an index, and no merge conflict in a shared file when two
villages are ingested at once.

Stored talks hold only authored fields. Event name, year, village name, YouTube
URL, and track display name are joined in at load time, so the same fact is never
stored twice and cannot drift.

## Rendering and scale

Everything is statically generated: `/`, and a page per event, village,
edition, track, topic, and talk.

The scale-sensitive page is `/`, which holds the whole index and filters on the
client. It receives a **`TalkIndexEntry`**, not a `Talk`:

- **No `summary`.** Summaries are 4–6 KB each; shipping them to a list view would
  put megabytes on the wire.
- **No search text.** `withHaystack` derives the lowercased search string on the
  client at mount. Every word in it already appears in the fields it is built
  from, so sending it roughly doubled the payload for no information.

Typing is wrapped in `useDeferredValue`, `q` is held outside the filter object so
a keystroke recomputes nothing until the deferred value lands, and results are
paginated at 24.

Measured against a synthetic archive of **2,792 talks across 30 villages and 4
events** (120 village files, 3,713 static pages): the home page is 1.6 MB
uncompressed and **95 KB gzipped**, served static with a TTFB of ~20 ms. Facets
collapse to their top eight with a filter box, and pagination reports 117 pages.

Filter state lives in the URL (`?q=&year=&village=&track=&topic=&sort=&page=`) via
`history.replaceState`, so a filtered view is shareable without a server round
trip or a history entry per keystroke.

**Past roughly ten thousand talks**, the next step is to stop embedding the whole
index in the home payload: emit it as a static JSON file per year and fetch on
demand, or move filtering to a server route. The filter logic in
`src/lib/search.ts` is pure and takes an array, so it works unchanged in either
place.

## Layout

- `src/lib/types.ts` — stored shapes and rendered shapes
- `src/lib/data.ts` — server-only loader, joins, counts, memoised
- `src/lib/search.ts` — pure filter, facet, sort, paginate, URL encoding
- `src/components/browser/` — the faceted browser (client)
- `src/components/` — cards, summary rendering, chrome
- `src/app/` — routes

`src/lib/data.ts` uses `node:fs` and must only be imported from server
components. Client components take data as props.
