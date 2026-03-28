import type { Task } from "graphile-worker";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, and, sql, lte, or, isNull } from "drizzle-orm";

/**
 * Dispatcher that runs every minute. Finds email connections that are due
 * for a sync based on their sync_interval_minutes and enqueues sync jobs.
 */
export const dispatchEmailSyncsTask: Task = async (_payload, helpers) => {
  const now = new Date();

  // Find connected accounts that are due for sync
  const dueConnections = await db
    .select({
      id: emailConnections.id,
      syncIntervalMinutes: emailConnections.syncIntervalMinutes,
      lastSyncedAt: emailConnections.lastSyncedAt,
    })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.status, "connected"),
        or(
          isNull(emailConnections.lastSyncedAt),
          sql`${emailConnections.lastSyncedAt} + (${emailConnections.syncIntervalMinutes} || ' minutes')::interval <= ${now.toISOString()}`
        )
      )
    );

  if (dueConnections.length === 0) return;

  helpers.logger.info(
    `Found ${dueConnections.length} email connections due for sync`
  );

  for (const conn of dueConnections) {
    await helpers.addJob("sync_email_interactions", {
      emailConnectionId: conn.id,
      triggeredBy: "scheduled",
    });
  }
};
