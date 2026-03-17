import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { asc } from "drizzle-orm";

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

  const { name, label, fieldType, options, required, sortOrder } = body;

  if (!name || !label || !fieldType) {
    return NextResponse.json(
      { error: "name, label, and fieldType are required." },
      { status: 400 }
    );
  }

  const validTypes = [
    "text",
    "number",
    "date",
    "select",
    "multiselect",
    "boolean",
    "url",
    "email",
  ];
  if (!validTypes.includes(fieldType)) {
    return NextResponse.json(
      { error: `fieldType must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const [field] = await db
      .insert(fieldDefinitions)
      .values({
        name,
        label,
        fieldType,
        options: options || null,
        required: required ?? false,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json(field, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: `A field with name "${name}" already exists.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
