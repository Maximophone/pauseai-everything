import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { previewSegment } from "@/lib/segments";
import { validateBody } from "@/lib/api-validate";
import { SegmentPreviewInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const body = await request.json();
  const parsed = validateBody(SegmentPreviewInput, body);
  if (!parsed.success) return parsed.error;

  const result = await previewSegment(parsed.data.filter, workspaceId);
  return NextResponse.json(result);
}
