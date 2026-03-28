import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections, emailContactSettings } from "@/db/schema/email-connections";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { ImportGmailContactsInput } from "@/lib/schemas";
import { createContact } from "@/lib/contacts";

// POST /api/email-connections/:id/contacts/import — add Gmail contacts to workspace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { id } = await params;

  // Verify ownership
  const [connection] = await db
    .select()
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.id, id),
        eq(emailConnections.userId, authResult.userId!)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = validateBody(ImportGmailContactsInput, body);
  if (!parsed.success) return parsed.error;

  const results = {
    created: 0,
    addedToWorkspace: 0,
    alreadyInWorkspace: 0,
    settingsCreated: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  for (const entry of parsed.data.contacts) {
    try {
      // Check if contact already exists by email
      const [existing] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, entry.email.toLowerCase()));

      let contactId: string;

      if (existing) {
        contactId = existing.id;

        // Check if already in this workspace
        const [inWorkspace] = await db
          .select()
          .from(contactWorkspaces)
          .where(
            and(
              eq(contactWorkspaces.contactId, contactId),
              eq(contactWorkspaces.workspaceId, connection.workspaceId)
            )
          );

        if (inWorkspace) {
          results.alreadyInWorkspace++;
        } else {
          // Add to workspace
          await db.insert(contactWorkspaces).values({
            contactId,
            workspaceId: connection.workspaceId,
            subscriptionStatus: "neutral",
          });
          results.addedToWorkspace++;
        }
      } else {
        // Create new contact
        const nameParts = (entry.name || "").split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        const newContact = await createContact(
          {
            email: entry.email.toLowerCase(),
            firstName,
            lastName,
            customFields: {},
          },
          connection.workspaceId
        );
        contactId = newContact.id;
        results.created++;
      }

      // Create or update email_contact_settings
      await db
        .insert(emailContactSettings)
        .values({
          emailConnectionId: id,
          contactId,
          syncInteractions: entry.syncInteractions,
          interactionsVisible: entry.interactionsVisible,
        })
        .onConflictDoUpdate({
          target: [
            emailContactSettings.emailConnectionId,
            emailContactSettings.contactId,
          ],
          set: {
            syncInteractions: entry.syncInteractions,
            interactionsVisible: entry.interactionsVisible,
            updatedAt: new Date(),
          },
        });
      results.settingsCreated++;
    } catch (err) {
      results.errors.push({
        email: entry.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json(results, { status: 201 });
}
