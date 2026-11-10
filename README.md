# CyberTalks

Searchable archive of cybersecurity conference talks, with the video and a short written summary of each one.

Live at [cybertalks.org](https://cybertalks.org).

Unofficial. Not affiliated with, sponsored by, or endorsed by any conference organizer.

## What's in it

About 50,000 talks from DEF CON, Black Hat, BSides, RSAC, TROOPERS and dozens of other conferences and conference YouTube channels.

Each talk has:

- the recording, embedded from YouTube where one is public
- speakers, conference, year, and village or track
- a track (a fixed category such as cloud or malware) and a few topic tags
- a short summary in our own words
- a difficulty level (beginner, intermediate, advanced, expert) where one has been rated
- links to slides or code when we have them

You can search by keyword and filter by conference, year, track, topic, and difficulty. Every talk, speaker, track, and topic has its own page.

## Content and copyright

Talk titles, speaker names, and recordings belong to their owners. Videos are embedded or linked, never re-hosted. Summaries are written for this site, and slide and code entries are links to where the material already lives.

If you are a speaker or organizer and something about your talk is wrong, or you want it changed or removed, open an issue on this repo.

## Fixing a talk

The JSON files under `data/` are the master copy of every talk. Nobody edits the live database by hand. To fix something, edit the file and open a pull request. Once it is merged, the site picks up the change on its own.

### Finding the talk

Every talk page URL ends in the talk's slug, for example `cybertalks.org/talks/<slug>`. Search for that slug (or the YouTube video ID) in `data/villages/` to find the file it lives in:

```bash
grep -rl '"slug": "<slug>"' data/villages/
```

### What you can change

Inside the talk's entry in `data/villages/<file>.json`:

| Field | What it is | Rules |
| --- | --- | --- |
| `title` | Talk title | As the speakers gave it |
| `speakers` | List of names | People who presented the talk, not hosts or moderators |
| `difficulty` | How much background the talk expects | `beginner`, `intermediate`, `advanced`, or `expert`. Leave the field out if you are not sure |
| `track` | The kind of work the talk covers | Must be one of the tracks in `data/taxonomy.json` |
| `topics` | A few subject tags | Short lowercase tags, such as `phishing` or `active-directory` |
| `teaser` | One-line description shown on cards | Your own words |
| `summary` | The longer write-up on the talk page | Your own words. Don't paste the talk's abstract or transcript |

Don't change `youtubeId` or `slug`. They are how the talk is found and linked, so changing them breaks existing links.

Slides, code, and other links for a talk live in `data/materials/<youtubeId>.json`, a list of entries like this:

```json
[
  {
    "type": "slides",
    "url": "https://example.com/talk-slides.pdf",
    "title": "Slides"
  }
]
```

`type` is one of `slides`, `repo`, `paper`, `whitepaper`, `demo`, `recording`, `tool`, `speaker-link`, `reference`, or `link`. Link to where the material already lives; files are never uploaded here.

### Changing a difficulty level

Difficulty is a judgment call, so say why in the pull request. One or two sentences is enough, for example "assumes you already know Kerberos delegation and walks through custom tooling, so advanced rather than intermediate." Ratings are based on what the talk itself covers, not on the title.

### Checking your change

```bash
npm run validate
```

This catches misspelled field names, tracks that aren't in the list, and difficulty values that aren't allowed. Run it before you open the pull request.

### Not comfortable with pull requests?

Open an issue with the talk's link and what should change. That works for wrong speakers, broken links, a difficulty that seems off, or a request to remove a talk.

## Data layout

```
data/events.json        events (slug, name, year, dates, location)
data/taxonomy.json      track list and topic display labels
data/villages/*.json    one file per village, track, or channel at one event, with its talks
data/materials/<youtubeId>.json  links for one talk (slides, code, other recordings)
data/view-counts.json   YouTube view counts used for "Most Watched"
```

Adding talks for a new event is adding a JSON file. No code change is needed.

## Running it locally

Needs Node 18.18 or newer.

```bash
npm install
npm run dev        # local site at http://localhost:3000
npm run validate   # check the data files
npm test           # unit tests
```

Without a database connection, the site reads the files generated from `data/` at build time.

## How it runs

The site is a Next.js app running on Cloudflare Workers, with the talk data in a Cloudflare D1 database that is synced from `data/` on every merge to `main`.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): pages, data model, and how search scales
- [docs/D1.md](docs/D1.md): how the database is synced from the JSON files
- [docs/ROLLBACK.md](docs/ROLLBACK.md): how to undo a bad release

## License

MIT
