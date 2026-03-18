import type { Task } from "graphile-worker";
import { db } from "@/db";
import { campaigns } from "@/db/schema/campaigns";
import { eq, and, lte, isNotNull } from "drizzle-orm";

/**
 * Runs every minute. Checks for scheduled campaigns whose scheduledAt time
 * has passed and enqueues send_campaign jobs for them.
 */
export const dispatchCampaignsTask: Task = async (_payload, helpers) => {
  const now = new Date();

  const due = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "draft"),
        isNotNull(campaigns.scheduledAt),
        lte(campaigns.scheduledAt, now)
      )
    );

  for (const campaign of due) {
    await helpers.addJob("send_campaign", { campaignId: campaign.id });
    helpers.logger.info(`Dispatched scheduled campaign "${campaign.name}" (${campaign.id})`);
  }

  if (due.length > 0) {
    helpers.logger.info(`Dispatched ${due.length} scheduled campaign(s)`);
  }
};
