import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections, emailContactSettings } from "@/db/schema/email-connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { BulkUpdateEmailContactSettingsInput } from "@/lib/schemas";

// GET /api/email-contact-settings — list all settings for current user's connections
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  // Get user's connection IDs
  const userConnections = await db
    .select({ id: emailConnections.id })
    .from(emailConnections)
    .where(eq(emailConnections.userId, authResult.userId!));

  if (userConnections.length === 0) {
    return NextResponse.json([]);
  }

  const connectionIds = userConnections.map((c) => c.id);
  const { inArray } = await import("drizzle-orm");
  const settings = await db
    .select()
    .from(emailContactSettings)
    .where(inArray(emailContactSettings.emailConnectionId, connectionIds));

  return NextResponse.json(settings);
}

// PUT /api/email-contact-settings — bulk update settings for multiple contacts
export async function PUT(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const body = await request.json();
  const parsed = validateBody(BulkUpdateEmailContactSettingsInput, body);
  if (!parsed.success) return parsed.error;

  // Get user's connection (use the first one — typically there's only one)
  const [connection] = await db
    .select({ id: emailConnections.id })
    .from(emailConnections)
    .where(eq(emailConnections.userId, authResult.userId!));

  if (!connection) {
    return NextResponse.json(
      { error: "No email connection found" },
      { status: 404 }
    );
  }

  const updated: string[] = [];
  for (const contactId of parsed.data.contactIds) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.syncInteractions !== undefined) {
      updateData.syncInteractions = parsed.data.syncInteractions;
    }
    if (parsed.data.interactionsVisible !== undefined) {
      updateData.interactionsVisible = parsed.data.interactionsVisible;
    }

    await db
      .insert(emailContactSettings)
      .values({
        emailConnectionId: connection.id,
        contactId,
        syncInteractions: parsed.data.syncInteractions ?? true,
        interactionsVisible: parsed.data.interactionsVisible ?? true,
      })
      .onConflictDoUpdate({
        target: [
          emailContactSettings.emailConnectionId,
          emailContactSettings.contactId,
        ],
        set: updateData,
      });
    updated.push(contactId);
  }

  return NextResponse.json({ updated: updated.length });
}
