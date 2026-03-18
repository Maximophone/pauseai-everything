import type { Task } from "graphile-worker";
import { db } from "@/db";
import { scripts } from "@/db/schema/scripts";
import { eq } from "drizzle-orm";
import { parseExpression } from "cron-parser";

/**
 * Runs every minute. Checks all enabled scripts with a cron schedule,
 * and enqueues run_script jobs for scripts whose schedule matches now.
 */
export const dispatchScriptsTask: Task = async (_payload, helpers) => {
  const now = new Date();

  const enabledScripts = await db
    .select()
    .from(scripts)
    .where(eq(scripts.enabled, true));

  const scheduled = enabledScripts.filter((s) => s.cronSchedule);

  let dispatched = 0;
  for (const script of scheduled) {
    try {
      const interval = parseExpression(script.cronSchedule!, { utc: true });
      const prev = interval.prev().toDate();

      // Check if the previous occurrence was within the last 90 seconds
      // (we run every minute, so this gives some slack)
      const diffMs = now.getTime() - prev.getTime();
      if (diffMs >= 0 && diffMs < 90_000) {
        // Don't re-dispatch if it ran recently (within 2 minutes)
        if (script.lastRunAt) {
          const sinceLastRun = now.getTime() - new Date(script.lastRunAt).getTime();
          if (sinceLastRun < 120_000) continue;
        }

        await helpers.addJob("run_script", {
          scriptId: script.id,
          triggeredBy: "cron",
        });
        dispatched++;
        helpers.logger.info(`Dispatched script "${script.name}" (${script.cronSchedule})`);
      }
    } catch (err) {
      helpers.logger.error(
        `Invalid cron expression for script "${script.name}": ${script.cronSchedule}`
      );
    }
  }

  if (dispatched > 0) {
    helpers.logger.info(`Dispatched ${dispatched} scheduled scripts`);
  }
};
