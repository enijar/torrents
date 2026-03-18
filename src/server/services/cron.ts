import { schedule } from "node-cron";
import updateStreams from "server/commands/update-streams.js";
import cleanupCache from "server/commands/cleanup-cache.js";

function timestamp() {
  return new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

export function startCron() {
  // Every 6 hours
  schedule("0 */6 * * *", async () => {
    console.log(`[${timestamp()}] [cron: start] update-streams`);
    try {
      await updateStreams();
      console.log(`[${timestamp()}] [cron: end] update-streams`);
    } catch (err) {
      console.error(`[${timestamp()}] [cron: error] update-streams`, err);
    }
  });

  // Every hour (at :30 to avoid collision with update-streams at :00)
  schedule("30 * * * *", async () => {
    console.log(`[${timestamp()}] [cron: start] cleanup-cache`);
    try {
      await cleanupCache();
      console.log(`[${timestamp()}] [cron: end] cleanup-cache`);
    } catch (err) {
      console.error(`[${timestamp()}] [cron: error] cleanup-cache`, err);
    }
  });
}
