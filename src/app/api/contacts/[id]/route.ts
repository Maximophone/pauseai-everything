import { NextRequest, NextResponse } from "next/server";
import {
  getContact,
  updateContact,
  deleteContact,
  validateCustomFields,
} from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { UpdateContactInput } from "@/lib/schemas";

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
  const parsed = validateBody(UpdateContactInput, body);
  if (!parsed.success) return parsed.error;

  // Validate custom fields if provided
  if (parsed.data.customFields && Object.keys(parsed.data.customFields).length > 0) {
    const validation = await validateCustomFields(parsed.data.customFields);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed.", details: validation.errors },
        { status: 400 }
      );
    }
  }

  const updated = await updateContact(id, {
    ...(parsed.data.email !== undefined && { email: parsed.data.email }),
    ...(parsed.data.firstName !== undefined && { firstName: parsed.data.firstName }),
    ...(parsed.data.lastName !== undefined && { lastName: parsed.data.lastName }),
    ...(parsed.data.customFields !== undefined && { customFields: parsed.data.customFields }),
    ...(parsed.data.communicationPreferences !== undefined && { communicationPreferences: parsed.data.communicationPreferences }),
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
