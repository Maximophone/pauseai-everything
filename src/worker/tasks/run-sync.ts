import type { Task } from "graphile-worker";
import { executeSyncRun } from "@/lib/sync-engine";

export const runSyncTask: Task = async (payload, helpers) => {
  const { syncConfigurationId, triggeredBy } = payload as {
    syncConfigurationId: string;
    triggeredBy: "manual" | "scheduled";
  };

  helpers.logger.info(
    `Running sync ${syncConfigurationId} (triggered by ${triggeredBy})`
  );

  const result = await executeSyncRun(syncConfigurationId, triggeredBy);

  if (result.status === "success" || result.status === "partial") {
    helpers.logger.info(`Sync ${syncConfigurationId} completed: ${result.status}`);
  } else if (result.status === "skipped_active_run") {
    helpers.logger.info(`Sync ${syncConfigurationId} skipped: another run is active`);
  } else {
    helpers.logger.error(`Sync ${syncConfigurationId} failed: ${result.status}`);
  }
};
