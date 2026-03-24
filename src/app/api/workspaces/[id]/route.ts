import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getWorkspace, updateWorkspace, deleteWorkspace } from "@/lib/workspaces";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/:id
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await params;
  const workspace = await getWorkspace(id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json(workspace);
}

// PUT /api/workspaces/:id
export async function PUT(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await params;
  const body = await request.json();
  const updated = await updateWorkspace(id, body);
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
