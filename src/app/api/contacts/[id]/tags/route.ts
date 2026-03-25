import { NextRequest, NextResponse } from "next/server";
import { getTagsForContact, addTagToContact, removeTagFromContact } from "@/lib/tags";
import { getContact } from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { ContactTagInput } from "@/lib/schemas";
import { checkAuth, requireAuth, requireMember } from "@/lib/api-auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id/tags
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;
  const { id } = await context.params;
  const workspaceId = await getActiveWorkspaceId(request);

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const contactTags = await getTagsForContact(id, workspaceId);
  return NextResponse.json(contactTags);
}

// POST /api/contacts/:id/tags — body: { tagId: string }
export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const authError = requireMember(authResult);
  if (authError) return authError;
  const { id } = await context.params;
  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  await addTagToContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id, workspaceId);
  return NextResponse.json(updatedTags);
}

// DELETE /api/contacts/:id/tags — body: { tagId: string }
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const authError = requireMember(authResult);
  if (authError) return authError;
  const { id } = await context.params;
  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  await removeTagFromContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id, workspaceId);
  return NextResponse.json(updatedTags);
}
