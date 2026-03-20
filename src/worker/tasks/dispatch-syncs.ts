import type { Task } from "graphile-worker";
import { db } from "@/db";
import { syncConfigurations } from "@/db/schema/connections";
import { eq, and, ne } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";

const FREQUENCY_CRON: Record<string, string> = {
  hourly: "0 * * * *",
  daily: "0 6 * * *",
  weekly: "0 6 * * 1",
};

// Minimum time between scheduled runs to avoid re-dispatching
const COOLDOWN_MS: Record<string, number> = {
  hourly: 50 * 60 * 1000, // 50 minutes
  daily: 22 * 60 * 60 * 1000, // 22 hours
  weekly: 6 * 24 * 60 * 60 * 1000, // 6 days
};

/**
 * Runs every minute. Checks all enabled sync configurations with a schedule,
 * and enqueues run_sync jobs for syncs whose schedule matches now.
 */
export const dispatchSyncsTask: Task = async (_payload, helpers) => {
  const now = new Date();

  const configs = await db
    .select()
    .from(syncConfigurations)
    .where(
      and(
        eq(syncConfigurations.enabled, true),
        eq(syncConfigurations.status, "active"),
        ne(syncConfigurations.syncFrequency, "manual")
      )
    );

  let dispatched = 0;
  for (const config of configs) {
    const cronExpr = FREQUENCY_CRON[config.syncFrequency];
    if (!cronExpr) continue;

    try {
      const interval = CronExpressionParser.parse(cronExpr);
      const prev = interval.prev().toDate();

      // Check if the previous cron occurrence was within the last 90 seconds
      const diffMs = now.getTime() - prev.getTime();
      if (diffMs >= 0 && diffMs < 90_000) {
        // Don't re-dispatch if it ran recently
        if (config.lastSyncAt) {
          const sinceLastSync = now.getTime() - new Date(config.lastSyncAt).getTime();
          const cooldown = COOLDOWN_MS[config.syncFrequency] || 120_000;
          if (sinceLastSync < cooldown) continue;
        }

        await helpers.addJob("run_sync", {
          syncConfigurationId: config.id,
          triggeredBy: "scheduled",
        });
        dispatched++;
        helpers.logger.info(
          `Dispatched sync "${config.name}" (${config.syncFrequency})`
        );
      }
    } catch (err) {
      helpers.logger.error(
        `Error dispatching sync "${config.name}": ${err instanceof Error ? err.message : err}`
      );
    }
  }

  if (dispatched > 0) {
    helpers.logger.info(`Dispatched ${dispatched} scheduled syncs`);
  }
};
