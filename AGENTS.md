# Agent instructions — CyberTalks

Public archive repo. Live claims/queue live in private **talk-ingest** `AGENT_HANDOFF.md` (sibling checkout). Do not invent a parallel board here. Never copy `AGENT_HANDOFF.md` or `AGENT_LOG.md` into this repo.

## Cursor Cloud

1. If talk-ingest is in the workspace, read its `AGENT_HANDOFF.md` first, then recent `AGENT_LOG.md`. Claim paths there.
2. Branch: `cursor/<claim-id>-<short-slug>` (lowercase).
3. Always OK to **propose** a CyberTalks PR or merge (open or draft a PR; ask Andrew to merge). Do not wait for wording GO. Do **not** execute a merge unless Andrew says **merge**.
4. After finishing: if talk-ingest is present, mark the claim `done`, add a **Done** line, append `AGENT_LOG.md`.

## Standing instructions (Andrew)

Record every instruction Andrew gives in this file, `CLAUDE.md`, `.cursor/rules/agent-handoff.mdc`, `.github/copilot-instructions.md`, and (when present) talk-ingest `AGENTS.md` / `AGENT_LOG.md`. Chat is not enough.

- **CyberTalks PR / merge:** always OK to draft/open a PR and to propose (ask Andrew to) merge it. Do not wait for wording GO. Do **not** squash-merge or merge until Andrew says **merge**.
- **Vercel (strict):** nothing builds on Vercel unless Andrew names the action (examples: “build production”, “deploy preview”).
  - Do not create, trigger, or propose Vercel **previews**.
  - Do not create, trigger, or propose Vercel **production** builds or deploys.
  - Opening a GitHub PR is not a reason to run Vercel.
  - Do not call Vercel APIs, Vercel MCP tools, or the `vercel` CLI.
  - This repo’s `vercel.json` already has `git.deploymentEnabled` limited to `main`. Do not change Vercel project settings (a settings change can itself trigger a build). Prefer instruction-file updates. If GitHub/Vercel would auto-build a preview from a PR, agents still must not invoke Vercel.
  - A feature GO, a PR, or a merge proposal is not a Vercel build.

Paste snippet if needed:

```
Read talk-ingest AGENT_HANDOFF.md first (if present), then recent AGENT_LOG.md. Claim paths. Branch cursor/<claim-id>-<slug>. CyberTalks PR open/propose and merge-propose always OK; do not merge until Andrew says merge. Vercel (strict): do not create, trigger, or propose previews or production unless Andrew names that action (e.g. build production, deploy preview). Do not call Vercel APIs or the vercel CLI.
```
