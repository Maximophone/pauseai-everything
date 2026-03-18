import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getAutomationRule, executeRule } from "@/lib/automations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const rule = await getAutomationRule(id);
  if (!rule) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  const affected = await executeRule(rule);
  return NextResponse.json({ affected });
}
