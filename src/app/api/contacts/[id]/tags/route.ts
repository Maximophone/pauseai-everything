import { NextRequest, NextResponse } from "next/server";
import { getTagsForContact, addTagToContact, removeTagFromContact } from "@/lib/tags";
import { getContact } from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { ContactTagInput } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id/tags
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const contactTags = await getTagsForContact(id);
  return NextResponse.json(contactTags);
}

// POST /api/contacts/:id/tags — body: { tagId: string }
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  await addTagToContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id);
  return NextResponse.json(updatedTags);
}

// DELETE /api/contacts/:id/tags — body: { tagId: string }
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  await removeTagFromContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id);
  return NextResponse.json(updatedTags);
}
