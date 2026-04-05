import { NextRequest, NextResponse } from "next/server";
import { getTagsForContact, addTagToContact, removeTagFromContact, getTag } from "@/lib/tags";
import { getContact } from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { ContactTagInput } from "@/lib/schemas";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contacts/:id/tags
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const { id } = await context.params;

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
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const { id } = await context.params;
  const body = await request.json();

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  // Validate tag belongs to the active workspace
  const tag = await getTag(parsed.data.tagId);
  if (!tag) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }
  if (tag.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Tag does not belong to this workspace." },
      { status: 400 }
    );
  }

  await addTagToContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id, workspaceId);
  return NextResponse.json(updatedTags);
}

// DELETE /api/contacts/:id/tags — body: { tagId: string }
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const { id } = await context.params;
  const body = await request.json();

  const parsed = validateBody(ContactTagInput, body);
  if (!parsed.success) return parsed.error;

  // Validate tag belongs to the active workspace
  const tag = await getTag(parsed.data.tagId);
  if (!tag) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }
  if (tag.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Tag does not belong to this workspace." },
      { status: 400 }
    );
  }

  await removeTagFromContact(id, parsed.data.tagId);
  const updatedTags = await getTagsForContact(id, workspaceId);
  return NextResponse.json(updatedTags);
}
