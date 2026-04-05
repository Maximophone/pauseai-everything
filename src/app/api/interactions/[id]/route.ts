import { NextRequest, NextResponse } from "next/server";
import { deleteInteraction } from "@/lib/interactions";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/interactions/:id
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const { id } = await context.params;
  const deleted = await deleteInteraction(id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Interaction not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
