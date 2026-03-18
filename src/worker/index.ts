import "dotenv/config";
import { run, TaskList, parseCronItems } from "graphile-worker";

import { sendCampaignTask } from "./tasks/send-campaign";
import { detectChurnTask } from "./tasks/detect-churn";
import { runScriptTask } from "./tasks/run-script";
import { dispatchScriptsTask } from "./tasks/dispatch-scripts";
import { dispatchCampaignsTask } from "./tasks/dispatch-campaigns";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const taskList: TaskList = {
  send_campaign: sendCampaignTask,
  detect_churn: detectChurnTask,
  run_script: runScriptTask,
  dispatch_scripts: dispatchScriptsTask,
  dispatch_campaigns: dispatchCampaignsTask,
};

const cronItems = parseCronItems([
  // Every day at 6am UTC — detect dormant contacts
  { task: "detect_churn", match: "0 6 * * *", identifier: "daily_churn_detection" },
  // Every minute — check for scheduled scripts to run
  { task: "dispatch_scripts", match: "* * * * *", identifier: "script_dispatcher" },
  // Every minute — check for scheduled campaigns to send
  { task: "dispatch_campaigns", match: "* * * * *", identifier: "campaign_dispatcher" },
]);

async function main() {
  const runner = await run({
    connectionString: DATABASE_URL,
    taskList,
    concurrency: 5,
    noHandleSignals: false,
    pollInterval: 1000,
    parsedCronItems: cronItems,
  });

  console.log("[worker] Started graphile-worker");

  await runner.promise;
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
