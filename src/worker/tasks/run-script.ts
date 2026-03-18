import type { Task } from "graphile-worker";
import { executeScript } from "@/lib/script-engine";

export const runScriptTask: Task = async (payload, helpers) => {
  const { scriptId, triggeredBy } = payload as {
    scriptId: string;
    triggeredBy: "manual" | "cron";
  };

  helpers.logger.info(`Running script ${scriptId} (triggered by ${triggeredBy})`);

  const result = await executeScript(scriptId, triggeredBy);

  if (result.status === "success") {
    helpers.logger.info(
      `Script ${scriptId} completed: ${result.contactsAffected} contacts affected`
    );
  } else {
    helpers.logger.error(`Script ${scriptId} failed: ${result.error}`);
  }
};
