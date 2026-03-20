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

  // Add subscription status and remove communicationPreferences from response
  const recipients = rawRecipients.map((r) => {
    const prefs = (r.communicationPreferences as Record<string, "subscribed" | "unsubscribed">) || {};
    let subscriptionStatus: "subscribed" | "not_subscribed" | "unsubscribed" = "subscribed";
    if (categoryName) {
      const pref = prefs[categoryName];
      if (pref === "subscribed") {
        subscriptionStatus = "subscribed";
      } else if (pref === "unsubscribed") {
        subscriptionStatus = "unsubscribed";
      } else {
        subscriptionStatus = "not_subscribed";
      }
    }
    return {
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      subscriptionStatus,
      // Keep boolean for backwards compat
      unsubscribed: subscriptionStatus !== "subscribed",
    };
  });

  // Sort: subscribed first, then not subscribed, then unsubscribed
  const statusOrder = { subscribed: 0, not_subscribed: 1, unsubscribed: 2 };
  recipients.sort((a, b) => statusOrder[a.subscriptionStatus] - statusOrder[b.subscriptionStatus]);

  const activeCount = recipients.filter((r) => r.subscriptionStatus === "subscribed").length;
  const notSubscribedCount = recipients.filter((r) => r.subscriptionStatus === "not_subscribed").length;
  const unsubscribedCount = recipients.filter((r) => r.subscriptionStatus === "unsubscribed").length;

  return NextResponse.json({
    count: recipients.length,
    activeCount,
    notSubscribedCount,
    unsubscribedCount,
    recipients,
  });
}
