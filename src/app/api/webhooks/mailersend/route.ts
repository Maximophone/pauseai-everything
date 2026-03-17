import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emails } from "@/db/schema/emails";
import { eq } from "drizzle-orm";

/**
 * Mailersend webhook endpoint.
 * Receives delivery events and updates the email status in our database.
 *
 * Events: sent, delivered, soft_bounced, hard_bounced, opened, clicked, unsubscribed, spam_complaint
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Mailersend sends events as { type, data: { ... } }
  // or as an array of events
  const events = Array.isArray(body) ? body : [body];

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
      await db
        .update(emails)
        .set({ status })
        .where(eq(emails.mailersendId, messageId));
    }
  }

  return NextResponse.json({ ok: true });
}
