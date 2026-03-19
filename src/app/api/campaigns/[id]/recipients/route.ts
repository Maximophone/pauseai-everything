import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getCampaign } from "@/lib/campaigns";
import { getSegment, getSegmentContactIds } from "@/lib/segments";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/recipients
 * Returns the list of contacts who would receive this campaign (based on its segment).
 * Works for both draft and sent campaigns.
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

  // Fetch contact details (id, name, email)
  const query = contactIds
    ? db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(contacts);

  const recipients = await query;

  return NextResponse.json({
    count: recipients.length,
    recipients,
  });
}
