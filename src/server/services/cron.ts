import { schedule } from "node-cron";
import updateStreams from "server/commands/update-streams.js";
import cleanupCache from "server/commands/cleanup-cache.js";

export function startCron() {
  // Every 6 hours
  schedule("0 */6 * * *", async () => {
    console.log("[cron: start] update-streams");
    try {
      await updateStreams();
      console.log("[cron: end] update-streams");
    } catch (err) {
      console.error("[cron: error] update-streams", err);
    }
  });

  // Every hour
  schedule("0 * * * *", async () => {
    console.log("[cron: start] cleanup-cache");
    try {
      await cleanupCache();
      console.log("[cron: end] cleanup-cache");
    } catch (err) {
      console.error("[cron: error] cleanup-cache", err);
    }
  });
}
