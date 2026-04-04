import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/workspace-context";
import { getWorkspace, updateWorkspace, deleteWorkspace } from "@/lib/workspaces";
import { validateBody } from "@/lib/api-validate";
import { UpdateWorkspaceInput } from "@/lib/schemas/workspaces";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id } = await params;

  // Must be a member of the workspace (or global admin) to view it
  const memberError = await requireWorkspaceMember(authResult, id);
  if (memberError) return memberError;

  const workspace = await getWorkspace(id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json(workspace);
}

// PUT /api/workspaces/:id
export async function PUT(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const { id } = await params;

  // Must be workspace admin (or global admin) to update
  const adminError = await requireWorkspaceAdmin(authResult, id);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(UpdateWorkspaceInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateWorkspace(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// DELETE /api/workspaces/:id
export async function DELETE(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await params;

  // Prevent deleting the global workspace
  const workspace = await getWorkspace(id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (workspace.type === "global") {
    return NextResponse.json(
      { error: "Cannot delete the global workspace" },
      { status: 400 }
    );
  }

  const deleted = await deleteWorkspace(id);
  if (!deleted) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
