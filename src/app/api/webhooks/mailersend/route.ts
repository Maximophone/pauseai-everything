import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emails } from "@/db/schema/emails";
import { campaigns } from "@/db/schema/campaigns";
import { contacts } from "@/db/schema/contacts";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, sql } from "drizzle-orm";

/**
 * Mailersend webhook endpoint.
 * Receives delivery events and updates the email status in our database,
 * then recalculates campaign aggregate counts.
 *
 * Events: sent, delivered, soft_bounced, hard_bounced, opened, clicked, unsubscribed, spam_complaint
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Mailersend sends events as { type, data: { ... } } or as an array
  const events = Array.isArray(body) ? body : [body];

  const affectedCampaignIds = new Set<string>();

  for (const event of events) {
    const type = event.type;
    const messageId = event.data?.message_id || event.data?.email?.message_id;

    if (!messageId) continue;

    // Map Mailersend event types to our status values
    let status: string | null = null;
    switch (type) {
      case "activity.sent":
        status = "sent";
        break;
      case "activity.delivered":
        status = "delivered";
        break;
      case "activity.soft_bounced":
      case "activity.hard_bounced":
        status = "bounced";
        break;
      case "activity.opened":
        status = "opened";
        break;
      case "activity.clicked":
        status = "clicked";
        break;
      case "activity.unsubscribed":
      case "activity.spam_complaint":
        status = "complained";
        break;
      default:
        continue;
    }

    if (status) {
      // Update the email status and get its metadata to find the campaignId
      const updated = await db
        .update(emails)
        .set({ status })
        .where(eq(emails.mailersendId, messageId))
        .returning({ metadata: emails.metadata, contactId: emails.contactId });

      if (updated.length > 0) {
        const meta = updated[0].metadata as Record<string, unknown> | null;
        if (meta?.campaignId && typeof meta.campaignId === "string") {
          affectedCampaignIds.add(meta.campaignId);

          // Handle unsubscribe: update contact's communication preferences
          if (type === "activity.unsubscribed" && updated[0].contactId) {
            await handleWebhookUnsubscribe(meta.campaignId, updated[0].contactId);
          }
        }
      }
    }
  }

  // Recalculate aggregate counts for any affected campaigns
  for (const campaignId of affectedCampaignIds) {
    await recalculateCampaignCounts(campaignId);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Recalculate campaign aggregate counts from the emails table.
 */
async function recalculateCampaignCounts(campaignId: string) {
  const [counts] = await db
    .select({
      sentCount: sql<number>`count(*) filter (where ${emails.status} in ('sent', 'delivered', 'opened', 'clicked'))`,
      deliveredCount: sql<number>`count(*) filter (where ${emails.status} in ('delivered', 'opened', 'clicked'))`,
      openedCount: sql<number>`count(*) filter (where ${emails.status} in ('opened', 'clicked'))`,
      clickedCount: sql<number>`count(*) filter (where ${emails.status} = 'clicked')`,
      bouncedCount: sql<number>`count(*) filter (where ${emails.status} = 'bounced')`,
    })
    .from(emails)
    .where(sql`${emails.metadata} @> ${JSON.stringify({ campaignId })}::jsonb`);

  await db
    .update(campaigns)
    .set({
      sentCount: Number(counts.sentCount),
      deliveredCount: Number(counts.deliveredCount),
      openedCount: Number(counts.openedCount),
      clickedCount: Number(counts.clickedCount),
      bouncedCount: Number(counts.bouncedCount),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));
}

/**
 * When Mailersend reports an unsubscribe, look up the campaign's category
 * and set that category to false in the contact's communication preferences.
 */
async function handleWebhookUnsubscribe(campaignId: string, contactId: string) {
  // Find the campaign's category
  const [campaign] = await db
    .select({ categoryId: campaigns.categoryId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign?.categoryId) return; // transactional campaign, nothing to update

  const [cat] = await db
    .select({ name: communicationCategories.name })
    .from(communicationCategories)
    .where(eq(communicationCategories.id, campaign.categoryId));

  if (!cat) return;

  const [contact] = await db
    .select({ communicationPreferences: contacts.communicationPreferences })
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (!contact) return;

  const prefs = (contact.communicationPreferences as Record<string, boolean>) || {};
  prefs[cat.name] = false;

  await db
    .update(contacts)
    .set({ communicationPreferences: prefs, updatedAt: new Date() })
    .where(eq(contacts.id, contactId));
}
