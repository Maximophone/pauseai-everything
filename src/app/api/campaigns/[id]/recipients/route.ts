import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getCampaign } from "@/lib/campaigns";
import { getSegment, getSegmentContactIds } from "@/lib/segments";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { communicationCategories } from "@/db/schema/communication-categories";
import { eq, inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/recipients
 * Returns the list of contacts who would receive this campaign (based on its segment).
 * Includes an `unsubscribed` flag for contacts who opted out of the campaign's category.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let contactIds: string[] | null = null;

  if (campaign.segmentId) {
    const segment = await getSegment(campaign.segmentId);
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }
    contactIds = await getSegmentContactIds(segment.filter);
  }

  // Look up the category name for this campaign (if any)
  let categoryName: string | null = null;
  if (campaign.categoryId) {
    const [cat] = await db
      .select()
      .from(communicationCategories)
      .where(eq(communicationCategories.id, campaign.categoryId));
    categoryName = cat?.name ?? null;
  }

  // Fetch contact details including communication preferences
  const query = contactIds
    ? db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          communicationPreferences: contacts.communicationPreferences,
        })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          communicationPreferences: contacts.communicationPreferences,
        })
        .from(contacts);

  const rawRecipients = await query;

  // Add unsubscribed flag and remove communicationPreferences from response
  const recipients = rawRecipients.map((r) => {
    const prefs = (r.communicationPreferences as Record<string, boolean>) || {};
    const unsubscribed = categoryName ? prefs[categoryName] === false : false;
    return {
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      unsubscribed,
    };
  });

  // Sort: unsubscribed contacts at the bottom
  recipients.sort((a, b) => {
    if (a.unsubscribed !== b.unsubscribed) return a.unsubscribed ? 1 : -1;
    return 0;
  });

  const activeCount = recipients.filter((r) => !r.unsubscribed).length;
  const unsubscribedCount = recipients.filter((r) => r.unsubscribed).length;

  return NextResponse.json({
    count: recipients.length,
    activeCount,
    unsubscribedCount,
    recipients,
  });
}
