import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/workspace-context";
import {
  getWorkspaceMembers,
  addUserToWorkspace,
} from "@/lib/workspaces";
import type { UserRole } from "@/db/schema/users";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id/members
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id } = await params;

  // Must be a member of the workspace (or global admin) to list members
  const memberError = await requireWorkspaceMember(authResult, id);
  if (memberError) return memberError;

  const members = await getWorkspaceMembers(id);
  return NextResponse.json(members);
}

// POST /api/workspaces/:id/members — add a user to the workspace
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id } = await params;
  const adminError = await requireWorkspaceAdmin(authResult, id);
  if (adminError) return adminError;

  const body = await request.json();
  const { userId, role } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await addUserToWorkspace(userId, id, (role as UserRole) || "viewer");
  return NextResponse.json({ success: true }, { status: 201 });
}
