import { NextRequest, NextResponse } from "next/server";
import {
  listInteractionsByContact,
  createInteraction,
  INTERACTION_TYPES,
} from "@/lib/interactions";
import { getContact } from "@/lib/contacts";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id/interactions
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const result = await listInteractionsByContact(id, {
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 50,
  });

  return NextResponse.json(result);
}

// POST /api/contacts/:id/interactions
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: contactId } = await context.params;
  const body = await request.json();

  const contact = await getContact(contactId);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const { type, subject, body: interactionBody, occurredAt, metadata } = body;

  if (!type) {
    return NextResponse.json(
      { error: "type is required." },
      { status: 400 }
    );
  }

  if (!INTERACTION_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${INTERACTION_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const interaction = await createInteraction({
    contactId,
    type,
    subject: subject || null,
    body: interactionBody || null,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    metadata: metadata || {},
  });

  return NextResponse.json(interaction, { status: 201 });
}
