import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { listScripts, createScript } from "@/lib/scripts";
import { validateBody } from "@/lib/api-validate";
import { CreateScriptInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const scripts = await listScripts(workspaceId);
  return NextResponse.json(scripts);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateScriptInput, body);
  if (!parsed.success) return parsed.error;

  const script = await createScript({
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    code: parsed.data.code,
    cronSchedule: parsed.data.cronSchedule ?? null,
    workspaceId,
  });

  return NextResponse.json(script, { status: 201 });
}
