import { NextRequest, NextResponse } from "next/server";
import {
  listInteractionsByContact,
  createInteraction,
} from "@/lib/interactions";
import { getContact } from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { CreateInteractionInput } from "@/lib/schemas";

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

  const parsed = validateBody(CreateInteractionInput, body);
  if (!parsed.success) return parsed.error;

  const interaction = await createInteraction({
    contactId,
    type: parsed.data.type,
    subject: parsed.data.subject || null,
    body: parsed.data.body || null,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
    metadata: parsed.data.metadata,
  });

  return NextResponse.json(interaction, { status: 201 });
}
