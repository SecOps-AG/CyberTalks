# Agent instructions — CyberTalks

This is the public CyberTalks site. Everything in this repo is public: code, comments, docs, data, commit messages, and PR text.

## Before any work

1. Team coordination (claims, queue, history, and the full rule set) lives in the maintainer's private coordination repo. Read its `AGENT_HANDOFF.md`, then the recent entries in its `AGENT_LOG.md`, before you explore or edit.
2. Claim your task there, work only on the claimed paths, and update both files when you start, finish, or pause.
3. If you cannot see the coordination repo, stop and ask the maintainer. Do not freelance.

## Hard rules

- **Pull requests:** draft the exact title and body in chat and wait for the maintainer's wording GO. After the GO, open and merge right away. No PR comments without the same GO.
- **No lingering branches:** delete a branch once it is merged.
- **Deploys:** a production deploy needs its own named GO from the maintainer. A feature, wording, or merge GO is not a deploy GO. Do not start preview or production builds unless the maintainer names that action.
- **Public text:** never copy coordination files (`AGENT_HANDOFF.md`, `AGENT_LOG.md`, agent-ops docs) or private catalog notes into this repo. Do not use internal project, pipeline, or vendor nicknames anywhere in this repo; the banned-word list is in the private rules. Check your diff and commit message before you push.
- **No GitHub link** or star button on the site.
- **Models:** inside Cursor use Cursor-native models only, unless the maintainer approves a different model for that run.
- After each task, report the model used, tokens, cost, and meter (or say unavailable).
