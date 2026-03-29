import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections, emailContactSettings } from "@/db/schema/email-connections";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and, inArray } from "drizzle-orm";
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

  const entries = parsed.data.contacts;
  const emails = entries.map((e) => e.email.toLowerCase());

  // Batch 1: Find all existing contacts by email in one query
  const existingContacts = await db
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(inArray(contacts.email, emails));

  const emailToContactId = new Map(
    existingContacts.map((c) => [c.email?.toLowerCase(), c.id])
  );

  // Batch 2: Check which existing contacts are already in this workspace
  const existingIds = existingContacts.map((c) => c.id);
  const workspaceMemberships = existingIds.length > 0
    ? await db
        .select({ contactId: contactWorkspaces.contactId })
        .from(contactWorkspaces)
        .where(
          and(
            inArray(contactWorkspaces.contactId, existingIds),
            eq(contactWorkspaces.workspaceId, connection.workspaceId)
          )
        )
    : [];
  const inWorkspaceSet = new Set(workspaceMemberships.map((m) => m.contactId));

  const results = {
    created: 0,
    addedToWorkspace: 0,
    alreadyInWorkspace: 0,
    settingsCreated: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  // Process each contact: only do individual queries for creates and workspace adds
  const settingsToUpsert: Array<{
    emailConnectionId: string;
    contactId: string;
    syncInteractions: boolean;
    interactionsVisible: boolean;
  }> = [];

  for (const entry of entries) {
    try {
      const normalizedEmail = entry.email.toLowerCase();
      const existingId = emailToContactId.get(normalizedEmail);
      let contactId: string;

      if (existingId) {
        contactId = existingId;

        if (inWorkspaceSet.has(contactId)) {
          results.alreadyInWorkspace++;
        } else {
          await db.insert(contactWorkspaces).values({
            contactId,
            workspaceId: connection.workspaceId,
            subscriptionStatus: "neutral",
          });
          results.addedToWorkspace++;
        }
      } else {
        // Create new contact (must be individual — createContact also links to workspace)
        const nameParts = (entry.name || "").split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        const newContact = await createContact(
          {
            email: normalizedEmail,
            firstName,
            lastName,
            customFields: {},
          },
          connection.workspaceId
        );
        contactId = newContact.id;
        results.created++;
      }

      settingsToUpsert.push({
        emailConnectionId: id,
        contactId,
        syncInteractions: entry.syncInteractions,
        interactionsVisible: entry.interactionsVisible,
      });
    } catch (err) {
      results.errors.push({
        email: entry.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Batch 3: Upsert all email_contact_settings at once
  if (settingsToUpsert.length > 0) {
    for (const setting of settingsToUpsert) {
      await db
        .insert(emailContactSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: [
            emailContactSettings.emailConnectionId,
            emailContactSettings.contactId,
          ],
          set: {
            syncInteractions: setting.syncInteractions,
            interactionsVisible: setting.interactionsVisible,
            updatedAt: new Date(),
          },
        });
    }
    results.settingsCreated = settingsToUpsert.length;
  }

  return NextResponse.json(results, { status: 201 });
}
