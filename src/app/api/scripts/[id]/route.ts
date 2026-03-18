import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getScript, updateScript, deleteScript } from "@/lib/scripts";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const script = await getScript(id);
  if (!script) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json(script);
}

export async function PUT(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const { name, description, code, cronSchedule, enabled } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (code !== undefined) data.code = code;
  if (cronSchedule !== undefined) data.cronSchedule = cronSchedule?.trim() || null;
  if (enabled !== undefined) data.enabled = enabled;

  const updated = await updateScript(id, data);
  if (!updated) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: Context) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteScript(id);
  if (!deleted) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
