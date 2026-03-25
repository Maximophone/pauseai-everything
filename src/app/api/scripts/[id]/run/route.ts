import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { executeScript } from "@/lib/script-engine";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";
import { getScript } from "@/lib/scripts";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;

  // Verify script belongs to this workspace
  const script = await getScript(id, workspaceId);
  if (!script) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }

  const result = await executeScript(id, "manual");
  return NextResponse.json(result);
}
