import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldDefinitions } from "@/db/schema/field-definitions";
import { eq } from "drizzle-orm";
import { validateBody } from "@/lib/api-validate";
import { UpdateFieldInput } from "@/lib/schemas";
import { checkAuth, requireAdmin } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/fields/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateFieldInput, body);
  if (!parsed.success) return parsed.error;

  const [updated] = await db
    .update(fieldDefinitions)
    .set({
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.fieldType !== undefined && { fieldType: parsed.data.fieldType }),
      ...(parsed.data.options !== undefined && { options: parsed.data.options }),
      ...(parsed.data.required !== undefined && { required: parsed.data.required }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
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
  request: NextRequest,
  context: RouteContext
) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
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
