import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listAutomationRules, createAutomationRule } from "@/lib/automations";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const rules = await listAutomationRules();
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const { name, description, config } = body;

  if (!name || !config || !config.conditions || !config.actions) {
    return NextResponse.json(
      { error: "name and config (with conditions and actions) are required." },
      { status: 400 }
    );
  }

  const rule = await createAutomationRule({ name, description, config });
  return NextResponse.json(rule, { status: 201 });
}
