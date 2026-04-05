import { NextRequest, NextResponse } from "next/server";
import { updateTag, deleteTag } from "@/lib/tags";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateTagInput } from "@/lib/schemas";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/tags/:id
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateTagInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateTag(id, stripNulls(parsed.data));
  if (!updated) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// DELETE /api/tags/:id
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;
  const { id } = await context.params;
  const deleted = await deleteTag(id);
  if (!deleted) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
