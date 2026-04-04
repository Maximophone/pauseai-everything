import { NextRequest, NextResponse } from "next/server";
import { deleteApiKey, getApiKey } from "@/lib/users";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/api-keys/:id — revoke an API key
// Workspace admins can revoke any key in their workspace.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;

  const apiKey = await getApiKey(id);
  if (!apiKey) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  // Must be a workspace admin in the key's workspace to revoke it
  const adminError = await requireWorkspaceAdmin(authResult, apiKey.workspaceId);
  if (adminError) return adminError;

  const deleted = await deleteApiKey(id);
  if (!deleted) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
