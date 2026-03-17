import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/fields/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const body = await request.json();

  const { label, fieldType, options, required, sortOrder } = body;

  const [updated] = await db
    .update(fieldDefinitions)
    .set({
      ...(label !== undefined && { label }),
      ...(fieldType !== undefined && { fieldType }),
      ...(options !== undefined && { options }),
      ...(required !== undefined && { required }),
      ...(sortOrder !== undefined && { sortOrder }),
    })
    .where(eq(fieldDefinitions.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Field definition not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

// DELETE /api/fields/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  const result = await db
    .delete(fieldDefinitions)
    .where(eq(fieldDefinitions.id, id))
    .returning({ id: fieldDefinitions.id });

  if (result.length === 0) {
    return NextResponse.json(
      { error: "Field definition not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
