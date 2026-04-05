import { NextRequest, NextResponse } from "next/server";
import {
  listContacts,
  createContact,
  findContactByEmail,
  validateCustomFields,
} from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { CreateContactInput } from "@/lib/schemas";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/workspace-context";
import { addContactToWorkspace } from "@/lib/workspaces";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { inArray, and, eq, sql, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getTagsForContacts } from "@/lib/tags";

// GET /api/contacts — list contacts with search, pagination, sorting
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const searchParams = request.nextUrl.searchParams;

  const result = await listContacts({
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 50,
    search: searchParams.get("search") || undefined,
    sortBy: searchParams.get("sortBy") || undefined,
    sortOrder:
      (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
    workspaceId,
  });

  // Embed tags so the client doesn't need a separate request per page (workspace-scoped)
  const tagsMap = await getTagsForContacts(result.contacts.map((c) => c.id), workspaceId);
  const contactsWithTags = result.contacts.map((c) => ({
    ...c,
    tags: tagsMap[c.id] ?? [],
  }));

  return NextResponse.json({ ...result, contacts: contactsWithTags });
}

// POST /api/contacts — create a contact
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;

  const body = await request.json();
  const parsed = validateBody(CreateContactInput, body);
  if (!parsed.success) return parsed.error;

  const { email, firstName, lastName, customFields } = parsed.data;

  // Validate custom fields if provided
  if (Object.keys(customFields).length > 0) {
    const validation = await validateCustomFields(customFields);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed.", details: validation.errors },
        { status: 400 }
      );
    }
  }

  // Dedup check: if email is provided, check if contact already exists
  if (email) {
    const existing = await findContactByEmail(email);
    if (existing) {
      // If addToWorkspace flag is set, link existing contact to this workspace
      if (body.addToWorkspace) {
        await addContactToWorkspace(existing.id, workspaceId);
        return NextResponse.json(existing, { status: 200 });
      }
      return NextResponse.json(
        {
          error: "A contact with this email already exists in the PauseAI network.",
          existsInNetwork: true,
          contactId: existing.id,
        },
        { status: 409 }
      );
    }
  }

  try {
    const contact = await createContact(
      {
        email: email ?? undefined,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        customFields,
      },
      workspaceId
    );
    return NextResponse.json(contact, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A contact with this email already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}

const BatchDeleteInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(10000),
});

// DELETE /api/contacts — batch delete contacts
// Global admins: hard delete. Workspace admins: remove from workspace only.
export async function DELETE(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (authError) return authError;

  const body = await request.json();
  const parsed = validateBody(BatchDeleteInput, body);
  if (!parsed.success) return parsed.error;

  const { ids } = parsed.data;

  if (authResult.role === "admin") {
    // Global admin: hard delete all
    await db.delete(contacts).where(inArray(contacts.id, ids));
  } else {
    // Workspace admin: remove workspace links
    await db
      .delete(contactWorkspaces)
      .where(
        and(
          inArray(contactWorkspaces.contactId, ids),
          eq(contactWorkspaces.workspaceId, workspaceId)
        )
      );

    // Delete contact records that have no remaining workspace links
    const orphaned = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, ids),
          sql`${contacts.id} NOT IN (
            SELECT ${contactWorkspaces.contactId} FROM ${contactWorkspaces}
          )`
        )
      );

    if (orphaned.length > 0) {
      await db
        .delete(contacts)
        .where(inArray(contacts.id, orphaned.map((o) => o.id)));
    }
  }

  return NextResponse.json({ deleted: ids.length });
}
