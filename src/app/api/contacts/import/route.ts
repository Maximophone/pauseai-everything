import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { eq } from "drizzle-orm";
import { validateBody } from "@/lib/api-validate";
import { ImportContactsInput } from "@/lib/schemas";
import { checkAuth, requireAdmin } from "@/lib/api-auth";

// POST /api/contacts/import
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
  const body = await request.json();
  const parsed = validateBody(ImportContactsInput, body);
  if (!parsed.success) return parsed.error;

  const rows = parsed.data.rows as Record<string, string>[];
  const mapping = parsed.data.mapping as Record<string, string>;
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

      for (const [csvColumn, targetField] of Object.entries(mapping)) {
        if (!targetField) continue; // skip unmapped columns

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
          if (skipDuplicates) {
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
          updated++;
          continue;
        }
      }

      // Create new contact
      await db.insert(contacts).values({
        email,
        firstName,
        lastName,
        customFields,
      });
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
