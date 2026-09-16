# CyberTalks

Searchable archive of DEF CON village talks — video, speakers, and an AI summary.

Unofficial. Not affiliated with, sponsored by, or endorsed by DEF CON or the Dark Tangent.

## Develop

```bash
npm install
npm run validate
npm run generate-shards
npm run dev
```

`npm run build` validates data, regenerates summary shards, then builds the Next.js site.

## Data shape

```
data/events.json      events (slug, name, year, dates, location)
data/taxonomy.json    tracks and topic display labels
data/villages/*.json  one village edition and its talks
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the information architecture and data model.

## License

MIT
