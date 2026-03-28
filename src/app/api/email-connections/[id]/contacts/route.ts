import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { emailContactSettings } from "@/db/schema/email-connections";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and, inArray } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { getValidAccessToken, fetchSentToContacts } from "@/lib/gmail";

// GET /api/email-connections/:id/contacts — list people the user has emailed
export async function GET(
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

  try {
    // Get valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(connection);

    // Fetch all unique email addresses from sent messages
    const gmailContacts = await fetchSentToContacts(accessToken);

    if (gmailContacts.length === 0) {
      return NextResponse.json({ contacts: [], total: 0 });
    }

    // Check which emails already exist in the CRM
    const emails = gmailContacts.map((c) => c.email);
    const existingContacts = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(contacts)
      .where(inArray(contacts.email, emails));

    const emailToContact = new Map(
      existingContacts.map((c) => [c.email?.toLowerCase(), c])
    );

    // Check which existing contacts are in the current workspace
    const existingIds = existingContacts.map((c) => c.id);
    const inWorkspace = existingIds.length > 0
      ? await db
          .select({
            contactId: contactWorkspaces.contactId,
          })
          .from(contactWorkspaces)
          .where(
            and(
              inArray(contactWorkspaces.contactId, existingIds),
              eq(contactWorkspaces.workspaceId, connection.workspaceId)
            )
          )
      : [];
    const workspaceContactIds = new Set(inWorkspace.map((r) => r.contactId));

    // Check which contacts have email_contact_settings for this connection
    const existingSettings = existingIds.length > 0
      ? await db
          .select({
            contactId: emailContactSettings.contactId,
            syncInteractions: emailContactSettings.syncInteractions,
            interactionsVisible: emailContactSettings.interactionsVisible,
          })
          .from(emailContactSettings)
          .where(
            and(
              eq(emailContactSettings.emailConnectionId, id),
              inArray(emailContactSettings.contactId, existingIds)
            )
          )
      : [];
    const settingsMap = new Map(
      existingSettings.map((s) => [s.contactId, s])
    );

    // Build response
    const result = gmailContacts.map((gc) => {
      const crmContact = emailToContact.get(gc.email);
      const inCrm = !!crmContact;
      const inCurrentWorkspace = crmContact
        ? workspaceContactIds.has(crmContact.id)
        : false;
      const settings = crmContact ? settingsMap.get(crmContact.id) : undefined;

      return {
        email: gc.email,
        gmailName: gc.name,
        inCrm,
        inCurrentWorkspace,
        crmContactId: crmContact?.id ?? null,
        crmFirstName: crmContact?.firstName ?? null,
        crmLastName: crmContact?.lastName ?? null,
        syncInteractions: settings?.syncInteractions ?? null,
        interactionsVisible: settings?.interactionsVisible ?? null,
      };
    });

    // Sort: CRM contacts first, then alphabetically
    result.sort((a, b) => {
      if (a.inCurrentWorkspace !== b.inCurrentWorkspace)
        return a.inCurrentWorkspace ? -1 : 1;
      if (a.inCrm !== b.inCrm) return a.inCrm ? -1 : 1;
      return a.email.localeCompare(b.email);
    });

    return NextResponse.json({ contacts: result, total: result.length });
  } catch (err) {
    console.error("Failed to fetch Gmail contacts:", err);
    return NextResponse.json(
      { error: "Failed to fetch Gmail contacts. Please try reconnecting." },
      { status: 500 }
    );
  }
}
