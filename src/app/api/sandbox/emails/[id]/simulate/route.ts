import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sandboxEmails } from "@/db/schema/sandbox-emails";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getEmailMode } from "@/lib/mailersend";
import {
  processEmailEvent,
  simpleEventToStatus,
  simpleEventToMailersendType,
} from "@/lib/email-events";
import { eq } from "drizzle-orm";

const VALID_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained", "unsubscribed"];

/**
 * POST /api/sandbox/emails/:id/simulate — Simulate a recipient event on one sandbox email.
 * Body: { event: "delivered" | "opened" | "clicked" | "bounced" | "complained" | "unsubscribed", url?: string }
 *
 * This calls the same internal logic as the Mailersend webhook handler, so the
 * emails table, campaign stats, and contact preferences are all updated.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (getEmailMode() !== "sandbox") {
    return NextResponse.json(
      { error: "Sandbox endpoints are only available when EMAIL_MODE=sandbox" },
      { status: 404 }
    );
  }

  const authResult = await checkAuth(request);
  const adminCheck = requireAdmin(authResult);
  if (adminCheck) return adminCheck;

  const { id } = await params;
  const body = await request.json();
  const event = body?.event as string;
  const url = body?.url as string | undefined;

  if (!event || !VALID_EVENTS.includes(event)) {
    return NextResponse.json(
      { error: `Invalid event. Must be one of: ${VALID_EVENTS.join(", ")}` },
      { status: 400 }
    );
  }

  // Find the sandbox email
  const [sandboxEmail] = await db
    .select()
    .from(sandboxEmails)
    .where(eq(sandboxEmails.id, id));

  if (!sandboxEmail) {
    return NextResponse.json({ error: "Sandbox email not found" }, { status: 404 });
  }

  const newStatus = simpleEventToStatus(event);
  if (!newStatus) {
    return NextResponse.json({ error: "Could not map event to status" }, { status: 400 });
  }

  // 1. Update sandbox_emails row
  const now = new Date();
  const historyEntry: { event: string; timestamp: string; url?: string } = {
    event,
    timestamp: now.toISOString(),
  };
  if (url) historyEntry.url = url;

  const currentHistory = (sandboxEmail.statusHistory as Array<{ event: string; timestamp: string; url?: string }>) || [];

  const [updated] = await db
    .update(sandboxEmails)
    .set({
      status: newStatus,
      statusHistory: [...currentHistory, historyEntry],
      updatedAt: now,
    })
    .where(eq(sandboxEmails.id, id))
    .returning();

  // 2. Process the event through the same logic as the Mailersend webhook handler
  const mailersendType = simpleEventToMailersendType(event);
  if (mailersendType) {
    await processEmailEvent(sandboxEmail.messageId, mailersendType);
  }

  return NextResponse.json(updated);
}
