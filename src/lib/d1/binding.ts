import { getCloudflareContext } from "@opennextjs/cloudflare";
import { asSql, type D1Like, type SqlClient } from "./sql";

/**
 * TALKS_DB from the worker config.
 * Missing when that binding is absent, which keeps reads on the built catalog.
 */
export async function talksSql(): Promise<SqlClient | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as { TALKS_DB?: D1Like }).TALKS_DB;
    if (!db || typeof db.prepare !== "function") return null;
    return asSql(db);
  } catch {
    return null;
  }
}
