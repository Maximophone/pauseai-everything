import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getSegment, updateSegment, deleteSegment } from "@/lib/segments";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateSegmentInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;

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
  const parsed = validateBody(UpdateSegmentInput, body);
  if (!parsed.success) return parsed.error;

  const updated = await updateSegment(id, stripNulls(parsed.data));
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
