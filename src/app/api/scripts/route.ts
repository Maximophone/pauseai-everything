import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listScripts, createScript } from "@/lib/scripts";
import { validateBody } from "@/lib/api-validate";
import { CreateScriptInput } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const scripts = await listScripts();
  return NextResponse.json(scripts);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateScriptInput, body);
  if (!parsed.success) return parsed.error;

  const script = await createScript({
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    code: parsed.data.code,
    cronSchedule: parsed.data.cronSchedule ?? null,
  });

  return NextResponse.json(script, { status: 201 });
}
