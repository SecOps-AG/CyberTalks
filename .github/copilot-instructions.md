# Copilot / GitHub agent instructions — CyberTalks

Public archive. Live claims/queue: private talk-ingest `AGENT_HANDOFF.md` (do not copy that file here).

## CyberTalks PRs

Always OK to **propose** a PR or merge (open or draft a PR; ask Andrew to merge). Do not wait for wording GO. Do **not** execute a merge unless Andrew says **merge**.

## Vercel (strict)

Nothing builds on Vercel unless Andrew names the action (examples: “build production”, “deploy preview”).

- Do not create, trigger, or propose Vercel **previews**.
- Do not create, trigger, or propose Vercel **production** builds or deploys.
- Opening a GitHub PR is not a reason to run Vercel.
- Do not call Vercel APIs, Vercel MCP tools, or the `vercel` CLI.
- `vercel.json` already has `git.deploymentEnabled` limited to `main`. Do not change Vercel project settings (a settings change can itself trigger a build). Prefer instruction-file updates. If GitHub/Vercel would auto-build a preview from a PR, agents still must not invoke Vercel.
- A feature GO, a PR, or a merge proposal is not a Vercel build.

Record Andrew’s instructions in `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/agent-handoff.mdc`, and this file (chat is not enough).
