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
import { eq, and, gte } from "drizzle-orm";

const VALID_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained", "unsubscribed"];

/**
 * POST /api/sandbox/emails/simulate-bulk — Simulate an event on all matching sandbox emails.
 * Body: { filter: { campaignId?, to?, workspaceId?, status?, since? }, event: "delivered" }
 */
export async function POST(request: NextRequest) {
  if (getEmailMode() !== "sandbox") {
    return NextResponse.json(
      { error: "Sandbox endpoints are only available when EMAIL_MODE=sandbox" },
      { status: 404 }
    );
  }

  const authResult = await checkAuth(request);
  const adminCheck = requireAdmin(authResult);
  if (adminCheck) return adminCheck;

  const body = await request.json();
  const event = body?.event as string;
  const filter = body?.filter as Record<string, string> | undefined;

  if (!event || !VALID_EVENTS.includes(event)) {
    return NextResponse.json(
      { error: `Invalid event. Must be one of: ${VALID_EVENTS.join(", ")}` },
      { status: 400 }
    );
  }

  const newStatus = simpleEventToStatus(event);
  const mailersendType = simpleEventToMailersendType(event);
  if (!newStatus || !mailersendType) {
    return NextResponse.json({ error: "Could not map event to status" }, { status: 400 });
  }

  // Build filter conditions
  const conditions = [];
  if (filter?.campaignId) conditions.push(eq(sandboxEmails.campaignId, filter.campaignId));
  if (filter?.to) conditions.push(eq(sandboxEmails.toEmail, filter.to));
  if (filter?.workspaceId) conditions.push(eq(sandboxEmails.workspaceId, filter.workspaceId));
  if (filter?.status) conditions.push(eq(sandboxEmails.status, filter.status));
  if (filter?.since) conditions.push(gte(sandboxEmails.createdAt, new Date(filter.since)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch matching sandbox emails
  const matchingEmails = await db
    .select({ id: sandboxEmails.id, messageId: sandboxEmails.messageId, statusHistory: sandboxEmails.statusHistory })
    .from(sandboxEmails)
    .where(where);

  if (matchingEmails.length === 0) {
    return NextResponse.json({ affected: 0 });
  }

  const now = new Date();
  const historyEntry = { event, timestamp: now.toISOString() };

  // Process each email
  for (const email of matchingEmails) {
    const currentHistory = (email.statusHistory as Array<{ event: string; timestamp: string }>) || [];

    await db
      .update(sandboxEmails)
      .set({
        status: newStatus,
        statusHistory: [...currentHistory, historyEntry],
        updatedAt: now,
      })
      .where(eq(sandboxEmails.id, email.id));

    await processEmailEvent(email.messageId, mailersendType);
  }

  return NextResponse.json({ affected: matchingEmails.length });
}
