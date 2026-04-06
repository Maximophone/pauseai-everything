import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { tags } from "@/db/schema/tags";
import { contactWorkspaces } from "@/db/schema/workspaces";
import { eq, and } from "drizzle-orm";
import { validateBody } from "@/lib/api-validate";
import { ImportContactsInput } from "@/lib/schemas";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { addTagToContact } from "@/lib/tags";

// POST /api/contacts/import
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();
  const parsed = validateBody(ImportContactsInput, body);
  if (!parsed.success) return parsed.error;

  const rows = parsed.data.rows as Record<string, string>[];
  const mapping = parsed.data.mapping as Record<string, string>;
  const constantValues = (parsed.data.constantValues ?? {}) as Record<string, unknown>;
  const skipDuplicates = parsed.data.skipDuplicates;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      let email: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      const customFields: Record<string, unknown> = {};

      // Apply CSV column mappings
      for (const [csvColumn, targetField] of Object.entries(mapping)) {
        if (!targetField) continue;

        const value = row[csvColumn]?.trim() || null;
        if (!value) continue;

        switch (targetField) {
          case "_email":
            email = value;
            break;
          case "_firstName":
            firstName = value;
            break;
          case "_lastName":
            lastName = value;
            break;
          default:
            customFields[targetField] = value;
        }
      }

      // Apply constant values (fixed values from the mapper)
      for (const [targetField, value] of Object.entries(constantValues)) {
        if (value === null || value === undefined || value === "") continue;
        switch (targetField) {
          case "_email":
            if (!email) email = value as string;
            break;
          case "_firstName":
            if (!firstName) firstName = value as string;
            break;
          case "_lastName":
            if (!lastName) lastName = value as string;
            break;
          case "_tags":
            // Tags handled separately after contact create/update
            break;
          default:
            // Only apply constant if CSV didn't already set a value
            if (customFields[targetField] === undefined) {
              customFields[targetField] = value;
            }
        }
      }

      // Resolve tag names from constant values
      const tagNames: string[] = [];
      const rawTags = constantValues._tags;
      if (Array.isArray(rawTags)) {
        tagNames.push(...rawTags.map(String).filter(Boolean));
      } else if (typeof rawTags === "string" && rawTags) {
        tagNames.push(...rawTags.split(",").map((s) => s.trim()).filter(Boolean));
      }

      if (!email && !firstName && !lastName) {
        skipped++;
        continue;
      }

      // Check for existing contact by email
      if (email) {
        const [existing] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.email, email));

        if (existing) {
          // Ensure workspace link exists regardless of skip/update
          await db
            .insert(contactWorkspaces)
            .values({ contactId: existing.id, workspaceId, subscriptionStatus: "neutral" })
            .onConflictDoNothing();

          if (skipDuplicates) {
            // Still apply tags even when skipping
            if (tagNames.length > 0) {
              await applyImportTags(existing.id, tagNames, workspaceId);
            }
            skipped++;
            continue;
          }
          // Update existing
          const mergedFields = { ...existing.customFields, ...customFields };
          await db
            .update(contacts)
            .set({
              firstName: firstName || existing.firstName,
              lastName: lastName || existing.lastName,
              customFields: mergedFields,
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, existing.id));
          if (tagNames.length > 0) {
            await applyImportTags(existing.id, tagNames, workspaceId);
          }
          updated++;
          continue;
        }
      }

      // Create new contact
      const [newContact] = await db.insert(contacts).values({
        email,
        firstName,
        lastName,
        customFields,
        createdByWorkspaceId: workspaceId,
      }).returning({ id: contacts.id });

      // Link to workspace
      await db
        .insert(contactWorkspaces)
        .values({ contactId: newContact.id, workspaceId, subscriptionStatus: "neutral" })
        .onConflictDoNothing();
      if (tagNames.length > 0) {
        await applyImportTags(newContact.id, tagNames, workspaceId);
      }
      created++;
    } catch (err) {
      errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    total: rows.length,
    created,
    updated,
    skipped,
    errors,
  });
}

// Find or create tags by name (workspace-scoped) and link to contact
async function applyImportTags(contactId: string, tagNames: string[], workspaceId: string | null) {
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    // Find existing tag in workspace
    const condition = workspaceId
      ? and(eq(tags.name, trimmed), eq(tags.workspaceId, workspaceId))
      : eq(tags.name, trimmed);

    let [tag] = await db.select().from(tags).where(condition!);

    if (!tag) {
      // Create tag
      [tag] = await db
        .insert(tags)
        .values({ name: trimmed, workspaceId })
        .onConflictDoNothing()
        .returning();

      // Re-select in case of race condition
      if (!tag) {
        [tag] = await db.select().from(tags).where(condition!);
      }
    }

    if (tag) {
      await addTagToContact(contactId, tag.id);
    }
  }
}
