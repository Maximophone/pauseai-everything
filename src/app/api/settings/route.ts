import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getAllSettings, setSetting } from "@/lib/app-settings";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const settings = await getAllSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be an object of { key: value } pairs" }, { status: 400 });
  }

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") {
      return NextResponse.json({ error: `Value for "${key}" must be a string` }, { status: 400 });
    }
    await setSetting(key, value);
  }

  const settings = await getAllSettings();
  return NextResponse.json(settings);
}
