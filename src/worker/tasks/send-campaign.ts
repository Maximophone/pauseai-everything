import type { Task } from "graphile-worker";
import { sendCampaign } from "@/lib/campaigns";

interface SendCampaignPayload {
  campaignId: string;
}

export const sendCampaignTask: Task = async (payload, helpers) => {
  const { campaignId } = payload as SendCampaignPayload;
  helpers.logger.info(`Sending campaign ${campaignId}`);

  try {
    const result = await sendCampaign(campaignId);
    helpers.logger.info(
      `Campaign ${campaignId} sent: ${result.sentCount} sent, ${result.bouncedCount} bounced`
    );
    if (result.warnings?.length) {
      for (const warning of result.warnings) {
        helpers.logger.warn(`Campaign ${campaignId}: ${warning}`);
      }
    }
  } catch (err) {
    helpers.logger.error(`Campaign ${campaignId} failed: ${err}`);
    throw err; // Let graphile-worker retry
  }
};
