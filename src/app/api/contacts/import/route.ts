import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { eq } from "drizzle-orm";

/**
 * POST /api/contacts/import
 *
 * Expects JSON body:
 * {
 *   "rows": [ { "col1": "val1", "col2": "val2", ... }, ... ],
 *   "mapping": {
 *     "col1": "_email",       // maps CSV column to email
 *     "col2": "_firstName",   // maps to firstName
 *     "col3": "_lastName",    // maps to lastName
 *     "col4": "country",      // maps to customFields.country
 *     "col5": null             // skip this column
 *   },
 *   "skipDuplicates": true    // skip rows where email already exists
 * }
 */

type ImportRequest = {
  rows: Record<string, string>[];
  mapping: Record<string, string | null>;
  skipDuplicates?: boolean;
};

export async function POST(request: NextRequest) {
  const body: ImportRequest = await request.json();
  const { rows, mapping, skipDuplicates = true } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "No rows to import." },
      { status: 400 }
    );
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return NextResponse.json(
      { error: "Column mapping is required." },
      { status: 400 }
    );
  }

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
