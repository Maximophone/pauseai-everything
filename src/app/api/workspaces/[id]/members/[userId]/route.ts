import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";
import {
  updateUserWorkspaceRole,
  removeUserFromWorkspace,
} from "@/lib/workspaces";
import type { UserRole } from "@/db/schema/users";

type Params = { params: Promise<{ id: string; userId: string }> };

// PUT /api/workspaces/:id/members/:userId — update role
export async function PUT(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id, userId } = await params;
  const adminError = await requireWorkspaceAdmin(authResult, id);
  if (adminError) return adminError;

  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, member, or viewer" },
      { status: 400 }
    );
  }

  await updateUserWorkspaceRole(userId, id, role as UserRole);
  return NextResponse.json({ success: true });
}

// DELETE /api/workspaces/:id/members/:userId — remove from workspace
export async function DELETE(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id, userId } = await params;
  const adminError = await requireWorkspaceAdmin(authResult, id);
  if (adminError) return adminError;

  await removeUserFromWorkspace(userId, id);
  return NextResponse.json({ success: true });
}
