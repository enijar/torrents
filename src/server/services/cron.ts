import { schedule } from "node-cron";
import updateStreams from "server/commands/update-streams.js";

export function startCron() {
  // Then every 6 hours
  schedule("0 */6 * * *", async () => {
    console.log("[cron: start] update-streams");
    try {
      await updateStreams();
      console.log("[cron: end] update-streams");
    } catch (err) {
      console.error("[cron: error] update-streams", err);
    }
  });
}
