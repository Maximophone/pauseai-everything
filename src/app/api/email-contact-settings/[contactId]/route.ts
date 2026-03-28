import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections, emailContactSettings } from "@/db/schema/email-connections";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateEmailContactSettingsInput } from "@/lib/schemas";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

// PUT /api/email-contact-settings/:contactId — update sync settings for a single contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { contactId } = await params;
  const workspaceId = await getActiveWorkspaceId(request);

  const body = await request.json();
  const parsed = validateBody(UpdateEmailContactSettingsInput, body);
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

  // Verify contact belongs to the user's workspace
  const [inWorkspace] = await db
    .select({ contactId: contactWorkspaces.contactId })
    .from(contactWorkspaces)
    .where(
      and(
        eq(contactWorkspaces.contactId, contactId),
        eq(contactWorkspaces.workspaceId, workspaceId)
      )
    );

  if (!inWorkspace) {
    return NextResponse.json(
      { error: "Contact not found in workspace" },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.syncInteractions !== undefined) {
    updateData.syncInteractions = parsed.data.syncInteractions;
  }
  if (parsed.data.interactionsVisible !== undefined) {
    updateData.interactionsVisible = parsed.data.interactionsVisible;
  }

  const [result] = await db
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
    })
    .returning();

  return NextResponse.json(result);
}
