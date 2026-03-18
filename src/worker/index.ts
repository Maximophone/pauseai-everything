import { run, TaskList, parseCronItems } from "graphile-worker";

import { sendCampaignTask } from "./tasks/send-campaign";
import { detectChurnTask } from "./tasks/detect-churn";
import { runAutomationsTask } from "./tasks/run-automations";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const taskList: TaskList = {
  send_campaign: sendCampaignTask,
  detect_churn: detectChurnTask,
  run_automations: runAutomationsTask,
};

const cronItems = parseCronItems([
  // Every day at 6am UTC — detect dormant contacts
  { task: "detect_churn", pattern: "0 6 * * *", identifier: "daily_churn_detection" },
  // Every hour — run automation rules
  { task: "run_automations", pattern: "0 * * * *", identifier: "hourly_automations" },
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
