# Rollback

The live site is the worker `cybertalks-d1`. It serves `cybertalks.org` and `www.cybertalks.org`.

`npm run deploy` reads `wrangler.jsonc`, checks that the worker name is `cybertalks-d1` and that `TALKS_DB` is `cybertalks-d1-prod`, then builds and deploys that worker. It does not read `wrangler.legacy.jsonc`.

The previous worker is named `cybertalks`. Its config is `wrangler.legacy.jsonc`. No script deploys that file. Do not modify, delete, or redeploy that worker. Branch `legacy-static` and tag `pre-d1-main` are the pre-D1 code and stay as they are.

`TALKS_DB` on the live worker is `cybertalks-d1-prod` (`8576a77a-240f-489d-9752-2fb6523d6b50`). The database `cybertalks-d1-preview` is the untouched fallback. The incremental cache bucket on the live worker is `cybertalks-d1-preview-cache`. The previous worker's cache bucket is `cybertalks-opennext-cache`.

The `cybertalks-d1` version deployed before the production database binding is `a4c16c09-6006-427e-8db7-f84fbfc1796a` (2026-10-27T21:07:53Z). The `cybertalks` worker version `4850ca4b-c44b-4966-a801-8f77aa4c1251` (2026-10-27T14:19:49Z) is the rollback worker and must stay as it is.

To put the live worker back on the fallback database, set the `TALKS_DB` `database_id` in `wrangler.jsonc` to the preview database and run `npm run deploy`. That uploads `cybertalks-d1` only.

To undo a bad deploy of `cybertalks-d1`, run `npx wrangler rollback` from this repo so it uses `wrangler.jsonc`. Do not pass `--config wrangler.legacy.jsonc`.

To serve the previous worker again, move the two custom domains back onto the existing `cybertalks` worker without uploading a new script to it.
