import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { asc } from "drizzle-orm";
import { validateBody } from "@/lib/api-validate";
import { CreateFieldInput } from "@/lib/schemas";

// GET /api/fields — list all field definitions
export async function GET() {
  const fields = await db
    .select()
    .from(fieldDefinitions)
    .orderBy(asc(fieldDefinitions.sortOrder));

  return NextResponse.json(fields);
}

// POST /api/fields — create a field definition
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = validateBody(CreateFieldInput, body);
  if (!parsed.success) return parsed.error;

  try {
    const [field] = await db
      .insert(fieldDefinitions)
      .values({
        name: parsed.data.name,
        label: parsed.data.label,
        fieldType: parsed.data.fieldType,
        options: parsed.data.options || null,
        required: parsed.data.required,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();

    return NextResponse.json(field, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: `A field with name "${parsed.data.name}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
