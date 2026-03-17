import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getSegment, updateSegment, deleteSegment } from "@/lib/segments";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const { id } = await context.params;
  const segment = await getSegment(id);
  if (!segment) {
    return NextResponse.json({ error: "Segment not found." }, { status: 404 });
  }

  return NextResponse.json(segment);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();

  const updated = await updateSegment(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Segment not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteSegment(id);
  if (!deleted) {
    return NextResponse.json({ error: "Segment not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
