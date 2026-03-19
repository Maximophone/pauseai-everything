import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getAutomationRule, updateAutomationRule, deleteAutomationRule } from "@/lib/automations";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateAutomationInput } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const rule = await getAutomationRule(id);
  if (!rule) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json(rule);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateAutomationInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateAutomationRule(id, stripNulls(parsed.data));
  if (!updated) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteAutomationRule(id);
  if (!deleted) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
