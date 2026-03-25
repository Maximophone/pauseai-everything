import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/users";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateUserInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";
import { updateUserWorkspaceRole, removeUserFromWorkspace } from "@/lib/workspaces";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/users/:id — update user's workspace role (workspace admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateUserInput, body);
  if (!parsed.success) return parsed.error;

  const user = await getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Prevent admins from demoting themselves
  if (id === authResult.userId && parsed.data.role !== "admin") {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  // Update workspace role, not global role
  await updateUserWorkspaceRole(id, workspaceId, parsed.data.role);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: parsed.data.role,
  });
}

// DELETE /api/users/:id — remove user from workspace (workspace admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;

  // Prevent admins from removing themselves
  if (id === authResult.userId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from this workspace." },
      { status: 400 }
    );
  }

  const user = await getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Remove from workspace, not from the system
  await removeUserFromWorkspace(id, workspaceId);
  return NextResponse.json({ success: true });
}
