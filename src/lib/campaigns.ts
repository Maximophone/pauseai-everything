import { db } from "@/db";
import { campaigns } from "@/db/schema/campaigns";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { emails } from "@/db/schema/emails";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { getSegment, getSegmentContactIds } from "./segments";
import { sendEmail, renderTemplate, resolveFromEmail } from "./mailersend";
import { buildUnsubscribeUrl } from "./unsubscribe-tokens";
import { getBooleanSetting, SETTING_KEYS } from "./app-settings";

export async function listCampaigns(workspaceId?: string) {
  if (workspaceId) {
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.workspaceId, workspaceId))
      .orderBy(desc(campaigns.createdAt));
  }
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
  workspaceId?: string;
  scheduledAt?: Date | null;
  createdBy?: string;
  allowNoUnsubscribe?: boolean;
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
    segmentId: string | null;
    categoryId: string | null;
    status: string;
    scheduledAt: string | Date | null;
    allowNoUnsubscribe: boolean;
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

  const campaignWorkspaceId = campaign.workspaceId;

  let contactIds: string[] = [];

  if (campaign.segmentId) {
    const segment = await getSegment(campaign.segmentId);
    if (!segment) throw new Error("Segment not found");
    // Cross-workspace segments bypass workspace scoping; but cross-workspace segments
    // cannot be used as campaign targets per spec. Enforce that here.
    if (segment.crossWorkspace) {
      throw new Error("Cross-workspace segments cannot be used as campaign targets");
    }
    // Scope to campaign workspace
    contactIds = await getSegmentContactIds(segment.filter, campaignWorkspaceId ?? undefined);
  } else if (campaignWorkspaceId) {
    // No segment = all contacts in this workspace
    const wsContacts = await db
      .select({ contactId: contactWorkspaces.contactId })
      .from(contactWorkspaces)
      .where(eq(contactWorkspaces.workspaceId, campaignWorkspaceId));
    contactIds = wsContacts.map((c) => c.contactId);
  } else {
    // Legacy: no workspace, all contacts
    const allContacts = await db
      .select({ id: contacts.id })
      .from(contacts);
    contactIds = allContacts.map((c) => c.id);
  }

  const fromEmail = campaign.fromEmail || await resolveFromEmail() || "noreply@pauseai.info";
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

  // Pre-flight check: can we generate unsubscribe URLs?
  // This matters for CAN-SPAM / GDPR compliance. We check once before the loop.
  let canGenerateUnsubscribeUrls = true;
  if (categoryName && campaignWorkspaceId) {
    try {
      // Test that the secret is configured by attempting to generate a dummy token
      buildUnsubscribeUrl("test", campaignWorkspaceId, categoryName);
    } catch {
      canGenerateUnsubscribeUrls = false;
    }
  }

  // Determine if the email body references the {{unsubscribe}} merge variable
  const bodyReferencesUnsubscribe = campaign.body.includes("{{unsubscribe}}");

  // Enforce unsubscribe mechanism for categorized campaigns
  if (categoryName) {
    const hasListUnsubscribeHeader = includeListUnsubscribeHeader && canGenerateUnsubscribeUrls;
    const hasBodyUnsubscribeLink = bodyReferencesUnsubscribe && canGenerateUnsubscribeUrls;

    if (!hasListUnsubscribeHeader && !hasBodyUnsubscribeLink) {
      const reasons: string[] = [];
      if (!canGenerateUnsubscribeUrls) {
        reasons.push("UNSUBSCRIBE_SECRET is not configured");
      }
      if (!includeListUnsubscribeHeader) {
        reasons.push("List-Unsubscribe header is disabled (requires MailerSend Professional+)");
      }
      if (!bodyReferencesUnsubscribe) {
        reasons.push("email body does not contain {{unsubscribe}} merge variable");
      }

      if (!campaign.allowNoUnsubscribe) {
        // Reset status back to draft since we're refusing to send
        await db
          .update(campaigns)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(campaigns.id, campaignId));
        throw new Error(
          `Campaign has category "${categoryName}" but no working unsubscribe mechanism (${reasons.join("; ")}). ` +
          `Either add an unsubscribe link to the email or edit the campaign and acknowledge the risk.`
        );
      }

      console.warn(
        `[campaigns] WARNING: Campaign "${campaign.name}" (${campaignId}) has category "${categoryName}" but NO working unsubscribe mechanism. ` +
        `Reasons: ${reasons.join("; ")}. ` +
        `Proceeding because allowNoUnsubscribe is set. This may violate CAN-SPAM/GDPR requirements.`
      );
    }
  }

  let sentCount = 0;
  let bouncedCount = 0;
  let skippedCount = 0;

  for (const contactId of contactIds) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    if (!contact || !contact.email) continue;

    // 1. Skip globally unsubscribed contacts
    if (contact.globallyUnsubscribed) {
      skippedCount++;
      continue;
    }

    // 2. Skip contacts unsubscribed from this workspace
    if (campaignWorkspaceId) {
      const [cwRow] = await db
        .select({ subscriptionStatus: contactWorkspaces.subscriptionStatus })
        .from(contactWorkspaces)
        .where(
          and(
            eq(contactWorkspaces.contactId, contactId),
            eq(contactWorkspaces.workspaceId, campaignWorkspaceId)
          )
        );
      if (!cwRow || cwRow.subscriptionStatus === "unsubscribed") {
        skippedCount++;
        continue;
      }
    }

    // 3. If campaign has a category, skip contacts who opted out (workspace-namespaced key)
    if (categoryName) {
      const prefs = (contact.communicationPreferences as Record<string, "subscribed" | "unsubscribed">) || {};
      const prefKey = campaignWorkspaceId
        ? `${campaignWorkspaceId}:${categoryName}`
        : categoryName;
      // Also check legacy flat key for backward compatibility
      const status = prefs[prefKey] ?? prefs[categoryName];
      if (status !== "subscribed") {
        skippedCount++;
        continue;
      }
    }

    // Build unsubscribe URL if campaign has a category and secret is configured
    let listUnsubscribe: string | undefined;
    let unsubscribeUrl = "";
    if (categoryName && campaignWorkspaceId && canGenerateUnsubscribeUrls) {
      unsubscribeUrl = buildUnsubscribeUrl(contact.id, campaignWorkspaceId, categoryName);
      listUnsubscribe = unsubscribeUrl;
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

  // Build warnings for the caller
  const warnings: string[] = [];
  if (categoryName) {
    const hasListUnsubscribeHeader = includeListUnsubscribeHeader && canGenerateUnsubscribeUrls;
    const hasBodyUnsubscribeLink = bodyReferencesUnsubscribe && canGenerateUnsubscribeUrls;
    if (!hasListUnsubscribeHeader && !hasBodyUnsubscribeLink) {
      warnings.push("Campaign sent without a working unsubscribe mechanism. This may violate CAN-SPAM/GDPR requirements.");
    }
  }

  return { sentCount, bouncedCount, skippedCount, totalContacts: contactIds.length, warnings };
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

  const fromEmail = campaign.fromEmail || await resolveFromEmail() || "noreply@pauseai.info";
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
