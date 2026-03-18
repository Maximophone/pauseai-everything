import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listScripts, createScript } from "@/lib/scripts";

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
  const { name, description, code, cronSchedule } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const script = await createScript({
    name: name.trim(),
    description: description?.trim() || null,
    code: code || "",
    cronSchedule: cronSchedule?.trim() || null,
  });

  return NextResponse.json(script, { status: 201 });
}
