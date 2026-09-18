# Claude / Claude Code — CyberTalks

Public archive repo. Live claims/queue live in private **talk-ingest** `AGENT_HANDOFF.md`. Do not invent a parallel board. Never copy `AGENT_HANDOFF.md` or `AGENT_LOG.md` into this repo.

## Before any work

1. If the sibling talk-ingest checkout is present, read `AGENT_HANDOFF.md` then recent `AGENT_LOG.md`.
2. If Orchestrator status is **paused**, do not start new work until Andrew says resume.
3. Claim before edit (in talk-ingest handoff when present). Branch `cursor/<claim-id>-<slug>` or `herdr/<claim-id>-<slug>`.

## On finish or pause

1. Update talk-ingest `AGENT_HANDOFF.md` + append `AGENT_LOG.md` when that repo is present.
2. Always OK to draft/open a CyberTalks PR and to **propose** merge. Do not wait for wording GO. Do **not** squash-merge until Andrew says **merge**.

## Standing instructions (Andrew)

Record every instruction Andrew gives here, in `AGENTS.md`, `.cursor/rules/agent-handoff.mdc`, `.github/copilot-instructions.md`, and talk-ingest copies when present. Chat is not enough.

- CyberTalks PR open/propose and merge-propose always OK. Do not squash-merge until Andrew says **merge**.
- **Vercel (strict):** nothing builds on Vercel unless Andrew names the action (examples: “build production”, “deploy preview”).
  - Do not create, trigger, or propose Vercel **previews**.
  - Do not create, trigger, or propose Vercel **production** builds or deploys.
  - Opening a GitHub PR is not a reason to run Vercel.
  - Do not call Vercel APIs, Vercel MCP tools, or the `vercel` CLI.
  - `vercel.json` already has `git.deploymentEnabled` limited to `main`. Do not change Vercel project settings (a settings change can itself trigger a build). Prefer instruction-file updates.
  - A feature GO, a PR, or a merge proposal is not a Vercel build.
