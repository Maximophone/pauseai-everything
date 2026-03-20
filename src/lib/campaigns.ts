import { db } from "@/db";
import { campaigns } from "@/db/schema/campaigns";
import { contacts } from "@/db/schema/contacts";
import { emails } from "@/db/schema/emails";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, asc, desc, sql } from "drizzle-orm";
import { getSegment, getSegmentContactIds } from "./segments";
import { sendEmail, renderTemplate } from "./mailersend";
import { buildUnsubscribeUrl } from "./unsubscribe-tokens";
import { getBooleanSetting, SETTING_KEYS } from "./app-settings";

export async function listCampaigns() {
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(id: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return campaign ?? null;
}

export async function createCampaign(data: {
  name: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  segmentId?: string;
  categoryId?: string | null;
  scheduledAt?: Date | null;
  createdBy?: string;
}) {
  const [campaign] = await db.insert(campaigns).values(data).returning();
  return campaign;
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string;
    subject: string;
    body: string;
    fromName: string;
    fromEmail: string;
    segmentId: string;
    categoryId: string | null;
    status: string;
    scheduledAt: string | Date | null;
  }>
) {
  // Convert scheduledAt string to Date for Drizzle
  const setData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (typeof setData.scheduledAt === "string") {
    setData.scheduledAt = new Date(setData.scheduledAt as string);
  }

  const [updated] = await db
    .update(campaigns)
    .set(setData as typeof campaigns.$inferInsert)
    .where(eq(campaigns.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteCampaign(id: string) {
  const result = await db
    .delete(campaigns)
    .where(eq(campaigns.id, id))
    .returning({ id: campaigns.id });
  return result.length > 0;
}

/**
 * Send a campaign to all contacts in its segment.
 * This is a synchronous send — for large campaigns,
 * this should be moved to a background job (Phase 8).
 */
export async function sendCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign already sent or sending");

  // Mark as sending
  await db
    .update(campaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  let contactIds: string[] = [];

  if (campaign.segmentId) {
    const segment = await getSegment(campaign.segmentId);
    if (!segment) throw new Error("Segment not found");
    contactIds = await getSegmentContactIds(segment.filter);
  } else {
    // No segment = all contacts
    const allContacts = await db
      .select({ id: contacts.id })
      .from(contacts);
    contactIds = allContacts.map((c) => c.id);
  }

  const fromEmail = campaign.fromEmail || process.env.MAILERSEND_FROM_EMAIL || "noreply@pauseai.info";
  const fromName = campaign.fromName || "PauseAI";

  // Look up the category for this campaign (if any)
  let categoryName: string | null = null;
  if (campaign.categoryId) {
    const [cat] = await db
      .select()
      .from(communicationCategories)
      .where(eq(communicationCategories.id, campaign.categoryId));
    categoryName = cat?.name ?? null;
  }

  // Check if list_unsubscribe header is enabled (requires Mailersend Professional+)
  const includeListUnsubscribeHeader = await getBooleanSetting(
    SETTING_KEYS.MAILERSEND_LIST_UNSUBSCRIBE
  );

  let sentCount = 0;
  let bouncedCount = 0;
  let skippedCount = 0;

  for (const contactId of contactIds) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    if (!contact || !contact.email) continue;

    // If campaign has a category, skip contacts who opted out
    if (categoryName) {
      const prefs = (contact.communicationPreferences as Record<string, boolean>) || {};
      if (prefs[categoryName] === false) {
        skippedCount++;
        continue;
      }
    }

    // Build unsubscribe URL if campaign has a category
    let listUnsubscribe: string | undefined;
    let unsubscribeUrl = "";
    if (categoryName) {
      try {
        unsubscribeUrl = buildUnsubscribeUrl(contact.id, categoryName);
        listUnsubscribe = unsubscribeUrl;
      } catch {
        // UNSUBSCRIBE_SECRET not configured — send without unsubscribe
      }
    }

    // Merge template fields
    const mergeData: Record<string, unknown> = {
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email,
      unsubscribe: unsubscribeUrl,
      ...((contact.customFields as Record<string, unknown>) || {}),
    };

    const renderedSubject = renderTemplate(campaign.subject, mergeData);
    const renderedBody = renderTemplate(campaign.body, mergeData);

    const result = await sendEmail({
      to: [{ email: contact.email, name: contact.firstName || undefined }],
      from: { email: fromEmail, name: fromName },
      subject: renderedSubject,
      html: renderedBody,
      tags: [`campaign:${campaignId}`],
      listUnsubscribe,
      includeListUnsubscribeHeader,
    });

    // Log the email
    await db.insert(emails).values({
      contactId: contact.id,
      direction: "outbound",
      fromAddress: fromEmail,
      toAddress: contact.email,
      subject: renderedSubject,
      body: renderedBody,
      status: result.ok ? "sent" : "failed",
      mailersendId: result.messageId || null,
      metadata: { campaignId },
    });

    if (result.ok) sentCount++;
    else bouncedCount++;
  }

  // Update campaign stats
  await db
    .update(campaigns)
    .set({
      status: "sent",
      sentCount,
      bouncedCount,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  return { sentCount, bouncedCount, skippedCount, totalContacts: contactIds.length };
}

/**
 * Get all emails sent for a campaign, with contact info.
 */
export async function getCampaignEmails(campaignId: string) {
  const result = await db
    .select({
      id: emails.id,
      contactId: emails.contactId,
      toAddress: emails.toAddress,
      subject: emails.subject,
      status: emails.status,
      mailersendId: emails.mailersendId,
      createdAt: emails.createdAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(emails)
    .leftJoin(contacts, eq(emails.contactId, contacts.id))
    .where(sql`${emails.metadata} @> ${JSON.stringify({ campaignId })}::jsonb`)
    .orderBy(desc(emails.createdAt));

  return result;
}

/**
 * Send a single preview email for a campaign to a test address.
 */
export async function sendPreviewEmail(
  campaignId: string,
  toEmail: string
) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const fromEmail = campaign.fromEmail || process.env.MAILERSEND_FROM_EMAIL || "noreply@pauseai.info";
  const fromName = campaign.fromName || "PauseAI";

  // Use placeholder merge data for preview
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const mergeData: Record<string, unknown> = {
    firstName: "Preview",
    lastName: "User",
    email: toEmail,
    unsubscribe: `${appUrl}/unsubscribe?preview=true`,
  };

  const renderedSubject = renderTemplate(`[PREVIEW] ${campaign.subject}`, mergeData);
  const renderedBody = renderTemplate(campaign.body, mergeData);

  const result = await sendEmail({
    to: [{ email: toEmail }],
    from: { email: fromEmail, name: fromName },
    subject: renderedSubject,
    html: renderedBody,
    tags: [`preview:${campaignId}`],
  });

  return result;
}
