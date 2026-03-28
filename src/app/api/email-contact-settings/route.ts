import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections, emailContactSettings } from "@/db/schema/email-connections";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and, inArray } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { BulkUpdateEmailContactSettingsInput } from "@/lib/schemas";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

// GET /api/email-contact-settings — list all settings for current user's connections in active workspace
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const workspaceId = await getActiveWorkspaceId(request);

  // Get user's connections for the active workspace only
  const userConnections = await db
    .select({ id: emailConnections.id })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.userId, authResult.userId!),
        eq(emailConnections.workspaceId, workspaceId)
      )
    );

  if (userConnections.length === 0) {
    return NextResponse.json([]);
  }

  const connectionIds = userConnections.map((c) => c.id);
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

  const workspaceId = await getActiveWorkspaceId(request);

  const body = await request.json();
  const parsed = validateBody(BulkUpdateEmailContactSettingsInput, body);
  if (!parsed.success) return parsed.error;

  // Get user's connection for the active workspace
  const [connection] = await db
    .select({ id: emailConnections.id })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.userId, authResult.userId!),
        eq(emailConnections.workspaceId, workspaceId)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "No email connection found" },
      { status: 404 }
    );
  }

  // Verify all contactIds belong to the user's workspace
  const workspaceContacts = await db
    .select({ contactId: contactWorkspaces.contactId })
    .from(contactWorkspaces)
    .where(
      and(
        inArray(contactWorkspaces.contactId, parsed.data.contactIds),
        eq(contactWorkspaces.workspaceId, workspaceId)
      )
    );
  const validContactIds = new Set(workspaceContacts.map((c) => c.contactId));
  const invalidIds = parsed.data.contactIds.filter((id) => !validContactIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Contacts not found in workspace: ${invalidIds.join(", ")}` },
      { status: 403 }
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
