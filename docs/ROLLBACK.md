# Rollback

The live site is the worker `cybertalks-d1`. It serves `cybertalks.org` and `www.cybertalks.org`.

`npm run deploy` reads `wrangler.jsonc`, checks that the worker name is `cybertalks-d1` and that `TALKS_DB` is `cybertalks-d1-prod`, then builds and deploys that worker. It does not read `wrangler.legacy.jsonc`.

The previous worker is named `cybertalks`. Its config is `wrangler.legacy.jsonc`. No script deploys that file. Do not modify, delete, or redeploy that worker. Branch `legacy-static` and tag `pre-d1-main` are the pre-D1 code and stay as they are.

`TALKS_DB` on the live worker is the database `cybertalks-d1-prod`. The database `cybertalks-d1-preview` is the untouched fallback.

To put the live worker back on the fallback database, set the `TALKS_DB` `database_id` in `wrangler.jsonc` to the preview database and run `npm run deploy`. That uploads `cybertalks-d1` only.

To undo a bad deploy of `cybertalks-d1`, run `npx wrangler rollback` from this repo so it uses `wrangler.jsonc`. Do not pass `--config wrangler.legacy.jsonc`.

To serve the previous worker again, move the two custom domains back onto the existing `cybertalks` worker without uploading a new script to it.
