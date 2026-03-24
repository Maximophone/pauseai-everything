import { db } from "@/db";
import { contacts, type Contact, type NewContact } from "@/db/schema/contacts";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq, ilike, or, and, sql, asc, desc, inArray } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────

export type ContactListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
  workspaceId?: string;
};

export type ContactListResult = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
};

// ── Queries ────────────────────────────────────────────────

export async function listContacts(
  params: ContactListParams = {}
): Promise<ContactListResult> {
  const {
    page = 1,
    pageSize = 50,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    workspaceId,
  } = params;

  const offset = (page - 1) * pageSize;

  // Build conditions array
  const conditions = [];

  // Workspace scoping via junction table
  if (workspaceId) {
    conditions.push(
      sql`${contacts.id} IN (
        SELECT ${contactWorkspaces.contactId}
        FROM ${contactWorkspaces}
        WHERE ${contactWorkspaces.workspaceId} = ${workspaceId}
      )`
    );
  }

  // Search across name and email
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(contacts.firstName, term),
        ilike(contacts.lastName, term),
        ilike(contacts.email, term)
      )!
    );
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  // Count total
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(contacts);
  if (whereClause) countQuery.where(whereClause);
  const [countResult] = await countQuery;
  const total = Number(countResult.count);

  // Sorting
  const sortColumn =
    sortBy === "firstName"
      ? contacts.firstName
      : sortBy === "lastName"
        ? contacts.lastName
        : sortBy === "email"
          ? contacts.email
          : contacts.createdAt;

  // Main query
  let query = db.select().from(contacts).$dynamic();
  if (whereClause) query = query.where(whereClause);
  query = query.orderBy(
    sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)
  );
  const result = await query.limit(pageSize).offset(offset);

  return {
    contacts: result,
    total,
    page,
    pageSize,
  };
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id));
  return contact;
}

export async function findContactByEmail(
  email: string
): Promise<Contact | undefined> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, email.toLowerCase().trim()));
  return contact;
}

export async function createContact(
  data: NewContact,
  workspaceId?: string
): Promise<Contact> {
  const [contact] = await db
    .insert(contacts)
    .values({
      ...data,
      customFields: data.customFields ?? {},
      createdByWorkspaceId: workspaceId ?? data.createdByWorkspaceId,
    })
    .returning();

  // Link to workspace
  if (workspaceId) {
    await db
      .insert(contactWorkspaces)
      .values({
        contactId: contact.id,
        workspaceId,
        subscriptionStatus: "neutral",
      })
      .onConflictDoNothing();
  }

  return contact;
}

export async function updateContact(
  id: string,
  data: Partial<NewContact>
): Promise<Contact | undefined> {
  const [contact] = await db
    .update(contacts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();
  return contact;
}

export async function deleteContact(id: string): Promise<boolean> {
  const result = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return result.length > 0;
}

// ── Field definitions ──────────────────────────────────────

/**
 * List field definitions visible to a workspace.
 * Returns: core fields (always) + global_internal (if global workspace) + workspace-scoped fields.
 */
export async function listFieldDefinitions(workspaceId?: string, isGlobalWorkspace?: boolean) {
  if (!workspaceId) {
    // Backward compat: return all
    return db
      .select()
      .from(fieldDefinitions)
      .orderBy(asc(fieldDefinitions.sortOrder));
  }

  // Core fields (scope=core, workspaceId=null) are always visible
  // Global internal fields (scope=global_internal) visible only if isGlobalWorkspace
  // Workspace-scoped fields visible only if matching workspaceId
  const conditions = [eq(fieldDefinitions.scope, "core")];

  if (isGlobalWorkspace) {
    conditions.push(eq(fieldDefinitions.scope, "global_internal"));
  }

  conditions.push(
    and(
      eq(fieldDefinitions.scope, "workspace"),
      eq(fieldDefinitions.workspaceId, workspaceId)
    )!
  );

  return db
    .select()
    .from(fieldDefinitions)
    .where(or(...conditions))
    .orderBy(asc(fieldDefinitions.sortOrder));
}

export async function validateCustomFields(
  fields: Record<string, unknown>,
  workspaceId?: string,
  isGlobalWorkspace?: boolean
): Promise<{ valid: boolean; errors: string[] }> {
  const definitions = await listFieldDefinitions(workspaceId, isGlobalWorkspace);
  const errors: string[] = [];

  for (const def of definitions) {
    const value = fields[def.name];

    // Check required
    if (def.required && (value === undefined || value === null || value === "")) {
      errors.push(`Field "${def.label}" is required.`);
      continue;
    }

    if (value === undefined || value === null || value === "") continue;

    // Type validation
    switch (def.fieldType) {
      case "number":
        if (typeof value !== "number") {
          errors.push(`Field "${def.label}" must be a number.`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          errors.push(`Field "${def.label}" must be a boolean.`);
        }
        break;
      case "select":
        if (def.options && !def.options.includes(value as string)) {
          errors.push(
            `Field "${def.label}" must be one of: ${def.options.join(", ")}.`
          );
        }
        break;
      case "multiselect":
        if (!Array.isArray(value)) {
          errors.push(`Field "${def.label}" must be an array.`);
        } else if (def.options) {
          const invalid = (value as string[]).filter(
            (v) => !def.options!.includes(v)
          );
          if (invalid.length > 0) {
            errors.push(
              `Field "${def.label}" contains invalid values: ${invalid.join(", ")}.`
            );
          }
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}
