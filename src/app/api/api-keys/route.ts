import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeysForWorkspace } from "@/lib/users";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateApiKeyInput } from "@/lib/schemas";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

// GET /api/api-keys — list API keys for the current workspace (workspace admin only)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace context required. Pass X-Workspace-Id header." },
      { status: 400 }
    );
  }

  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const keys = await listApiKeysForWorkspace(workspaceId);
  return NextResponse.json(keys);
}

// POST /api/api-keys — create a new API key in the current workspace (workspace admin only)
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace context required. Pass X-Workspace-Id header." },
      { status: 400 }
    );
  }

  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateApiKeyInput, body);
  if (!parsed.success) return parsed.error;

  const result = await createApiKey(authResult.userId!, workspaceId, parsed.data.name);

  return NextResponse.json(
    {
      id: result.id,
      name: result.name,
      keyPrefix: result.keyPrefix,
      workspaceId: result.workspaceId,
      rawKey: result.rawKey, // Only returned once!
      createdAt: result.createdAt,
    },
    { status: 201 }
  );
}
