import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getAutomationRule, updateAutomationRule, deleteAutomationRule } from "@/lib/automations";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateAutomationInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const rule = await getAutomationRule(id, workspaceId);
  if (!rule) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json(rule);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateAutomationInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateAutomationRule(id, stripNulls(parsed.data), workspaceId);
  if (!updated) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteAutomationRule(id, workspaceId);
  if (!deleted) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
