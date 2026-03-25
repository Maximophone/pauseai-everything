import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getScript, updateScript, deleteScript } from "@/lib/scripts";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateScriptInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const script = await getScript(id, workspaceId);
  if (!script) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json(script);
}

export async function PUT(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateScriptInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateScript(id, stripNulls(parsed.data), workspaceId);
  if (!updated) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteScript(id, workspaceId);
  if (!deleted) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
