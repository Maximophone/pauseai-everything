import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listSegments, createSegment } from "@/lib/segments";
import { validateBody } from "@/lib/api-validate";
import { CreateSegmentInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";
import { isWorkspaceGlobal } from "@/lib/workspaces";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;
  const segments = await listSegments(workspaceId);
  return NextResponse.json(segments);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();
  const parsed = validateBody(CreateSegmentInput, body);
  if (!parsed.success) return parsed.error;

  // Only the Global workspace can create cross-workspace segments
  if (parsed.data.crossWorkspace) {
    const isGlobal = await isWorkspaceGlobal(workspaceId);
    if (!isGlobal) {
      return NextResponse.json(
        { error: "Only the Global workspace can create cross-workspace segments." },
        { status: 403 }
      );
    }
  }

  const segment = await createSegment({
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    filter: parsed.data.filter,
    crossWorkspace: parsed.data.crossWorkspace ?? false,
    createdBy: authResult.userId,
    workspaceId,
  });

  return NextResponse.json(segment, { status: 201 });
}
