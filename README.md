# CyberTalks

Searchable archive of cybersecurity conference talks — video, speakers, and AI summaries.

Unofficial. Not affiliated with, sponsored by, or endorsed by any conference organizer.

## Data shape

data/events.json      events (slug, name, year, dates, location)
data/taxonomy.json    tracks and topic display labels
data/villages/*.json  one village/track edition and its talks

See docs/ARCHITECTURE.md for the information architecture and data model.

## Agents

If the private **talk-ingest** sibling checkout is present, read its `AGENT_HANDOFF.md` first (live claims board; do not copy it here). Durable rules for this repo: [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md).

Always OK to **propose** a PR or merge (open or draft a PR; ask Andrew to merge). Do not execute a merge unless Andrew says **merge**.

**Vercel (strict):** nothing builds on Vercel unless Andrew names the action (examples: “build production”, “deploy preview”). Do not create, trigger, or propose previews or production builds/deploys. Opening a GitHub PR is not a reason to run Vercel. Do not call Vercel APIs or the `vercel` CLI. `vercel.json` already limits `git.deploymentEnabled` to `main`; do not change Vercel project settings.

## License

MIT
