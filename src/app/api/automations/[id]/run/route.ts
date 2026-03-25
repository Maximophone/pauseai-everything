import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getAutomationRule, executeRule } from "@/lib/automations";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const { id } = await context.params;
  const rule = await getAutomationRule(id, workspaceId);
  if (!rule) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  const affected = await executeRule(rule);
  return NextResponse.json({ affected });
}
