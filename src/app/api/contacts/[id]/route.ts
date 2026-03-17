import { NextRequest, NextResponse } from "next/server";
import {
  getContact,
  updateContact,
  deleteContact,
  validateCustomFields,
} from "@/lib/contacts";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const contact = await getContact(id);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json(contact);
}

// PUT /api/contacts/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const body = await request.json();

  const { email, firstName, lastName, customFields } = body;

  // Validate custom fields if provided
  if (customFields && Object.keys(customFields).length > 0) {
    const validation = await validateCustomFields(customFields);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed.", details: validation.errors },
        { status: 400 }
      );
    }
  }

  const updated = await updateContact(id, {
    ...(email !== undefined && { email }),
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(customFields !== undefined && { customFields }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/contacts/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const deleted = await deleteContact(id);

  if (!deleted) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
