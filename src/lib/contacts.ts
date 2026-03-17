import { db } from "@/db";
import { contacts, type Contact, type NewContact } from "@/db/schema/contacts";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq, ilike, or, sql, asc, desc } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────

export type ContactListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
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
  } = params;

  const offset = (page - 1) * pageSize;

  let query = db.select().from(contacts).$dynamic();

  // Search across name and email
  if (search) {
    const term = `%${search}%`;
    query = query.where(
      or(
        ilike(contacts.firstName, term),
        ilike(contacts.lastName, term),
        ilike(contacts.email, term)
      )
    );
  }

  // Sorting
  const sortColumn =
    sortBy === "firstName"
      ? contacts.firstName
      : sortBy === "lastName"
        ? contacts.lastName
        : sortBy === "email"
          ? contacts.email
          : contacts.createdAt;

  query = query.orderBy(
    sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)
  );

  // Count total (before pagination)
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts);
  const total = Number(countResult.count);

  // Paginate
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

export async function createContact(
  data: NewContact
): Promise<Contact> {
  const [contact] = await db
    .insert(contacts)
    .values({
      ...data,
      customFields: data.customFields ?? {},
    })
    .returning();
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

export async function listFieldDefinitions() {
  return db
    .select()
    .from(fieldDefinitions)
    .orderBy(asc(fieldDefinitions.sortOrder));
}

export async function validateCustomFields(
  fields: Record<string, unknown>
): Promise<{ valid: boolean; errors: string[] }> {
  const definitions = await listFieldDefinitions();
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
