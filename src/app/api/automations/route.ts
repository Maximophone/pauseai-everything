import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { listAutomationRules, createAutomationRule } from "@/lib/automations";
import { validateBody } from "@/lib/api-validate";
import { CreateAutomationInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const rules = await listAutomationRules(workspaceId);
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateAutomationInput, body);
  if (!parsed.success) return parsed.error;

  const rule = await createAutomationRule({
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    config: parsed.data.config,
    workspaceId,
  });
  return NextResponse.json(rule, { status: 201 });
}
