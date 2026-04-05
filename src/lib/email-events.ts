/**
 * Shared email event processing logic.
 * Used by both the Mailersend webhook handler and the sandbox event simulation API.
 * Any change to how delivery events are processed should happen here.
 */

import { db } from "@/db";
import { emails } from "@/db/schema/emails";
import { campaigns } from "@/db/schema/campaigns";
import { contacts } from "@/db/schema/contacts";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, sql } from "drizzle-orm";

/** Map of Mailersend event types to our internal email statuses. */
export const EVENT_TO_STATUS: Record<string, string> = {
  "activity.sent": "sent",
  "activity.delivered": "delivered",
  "activity.soft_bounced": "bounced",
  "activity.hard_bounced": "bounced",
  "activity.opened": "opened",
  "activity.clicked": "clicked",
  "activity.unsubscribed": "complained",
  "activity.spam_complaint": "complained",
};

/** Simplified event names used by the sandbox simulate endpoint. */
const SIMPLE_EVENT_TO_MAILERSEND: Record<string, string> = {
  sent: "activity.sent",
  delivered: "activity.delivered",
  opened: "activity.opened",
  clicked: "activity.clicked",
  bounced: "activity.hard_bounced",
  complained: "activity.spam_complaint",
  unsubscribed: "activity.unsubscribed",
};

/**
 * Convert a simple event name (e.g. "delivered") to the internal status string.
 */
export function simpleEventToStatus(event: string): string | null {
  const mailersendEvent = SIMPLE_EVENT_TO_MAILERSEND[event];
  if (!mailersendEvent) return null;
  return EVENT_TO_STATUS[mailersendEvent] ?? null;
}

/**
 * Get the Mailersend-style event type for a simple event name.
 */
export function simpleEventToMailersendType(event: string): string | null {
  return SIMPLE_EVENT_TO_MAILERSEND[event] ?? null;
}

/**
 * Process a single email event: update the email status, handle unsubscribes,
 * and recalculate campaign counts.
 *
 * @param messageId - The mailersendId / sandbox messageId stored in the emails table
 * @param eventType - Mailersend-style event type (e.g. "activity.delivered")
 */
export async function processEmailEvent(
  messageId: string,
  eventType: string
): Promise<{ updated: boolean; campaignId?: string }> {
  const status = EVENT_TO_STATUS[eventType];
  if (!status) return { updated: false };

  const updated = await db
    .update(emails)
    .set({ status })
    .where(eq(emails.mailersendId, messageId))
    .returning({ metadata: emails.metadata, contactId: emails.contactId });

  if (updated.length === 0) return { updated: false };

  const meta = updated[0].metadata as Record<string, unknown> | null;
  const campaignId =
    meta?.campaignId && typeof meta.campaignId === "string"
      ? meta.campaignId
      : undefined;

  if (campaignId) {
    // Handle unsubscribe
    if (eventType === "activity.unsubscribed" && updated[0].contactId) {
      await handleUnsubscribe(campaignId, updated[0].contactId);
    }

    // Recalculate campaign aggregate counts
    await recalculateCampaignCounts(campaignId);
  }

  return { updated: true, campaignId };
}

/**
 * When an unsubscribe event fires, look up the campaign's category
 * and set that category to "unsubscribed" in the contact's communication preferences.
 */
export async function handleUnsubscribe(campaignId: string, contactId: string) {
  const [campaign] = await db
    .select({
      categoryId: campaigns.categoryId,
      workspaceId: campaigns.workspaceId,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign?.categoryId || !campaign?.workspaceId) return;

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

  const prefKey = `${campaign.workspaceId}:${cat.name}`;
  const prefs =
    (contact.communicationPreferences as Record<
      string,
      "subscribed" | "unsubscribed"
    >) || {};
  prefs[prefKey] = "unsubscribed";

  await db
    .update(contacts)
    .set({ communicationPreferences: prefs, updatedAt: sql`now()` })
    .where(eq(contacts.id, contactId));
}

/**
 * Recalculate campaign aggregate counts from the emails table.
 */
export async function recalculateCampaignCounts(campaignId: string) {
  const [counts] = await db
    .select({
      sentCount: sql<number>`count(*) filter (where ${emails.status} in ('sent', 'delivered', 'opened', 'clicked'))`,
      deliveredCount: sql<number>`count(*) filter (where ${emails.status} in ('delivered', 'opened', 'clicked'))`,
      openedCount: sql<number>`count(*) filter (where ${emails.status} in ('opened', 'clicked'))`,
      clickedCount: sql<number>`count(*) filter (where ${emails.status} = 'clicked')`,
      bouncedCount: sql<number>`count(*) filter (where ${emails.status} = 'bounced')`,
    })
    .from(emails)
    .where(
      sql`${emails.metadata} @> ${JSON.stringify({ campaignId })}::jsonb`
    );

  await db
    .update(campaigns)
    .set({
      sentCount: Number(counts.sentCount),
      deliveredCount: Number(counts.deliveredCount),
      openedCount: Number(counts.openedCount),
      clickedCount: Number(counts.clickedCount),
      bouncedCount: Number(counts.bouncedCount),
      updatedAt: sql`now()`,
    })
    .where(eq(campaigns.id, campaignId));
}
