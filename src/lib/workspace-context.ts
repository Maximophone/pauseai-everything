import { NextRequest, NextResponse } from "next/server";
import { getGlobalWorkspaceId, getEffectiveRole } from "./workspaces";
import type { AuthResult } from "./api-auth";
import type { UserRole } from "@/db/schema/users";

/**
 * Extract the active workspace ID from a request.
 * Checks (in order): X-Workspace-Id header, ?workspaceId query param, fallback to Global.
 */
export async function getActiveWorkspaceId(
  request: NextRequest
): Promise<string> {
  // 1. Header
  const headerWs = request.headers.get("x-workspace-id");
  if (headerWs) return headerWs;

  // 2. Query param
  const urlWs = request.nextUrl.searchParams.get("workspaceId");
  if (urlWs) return urlWs;

  // 3. Cookie
  const cookieWs = request.cookies.get("pauseai_workspace")?.value;
  if (cookieWs) return cookieWs;

  // 4. Fallback to Global workspace
  return getGlobalWorkspaceId();
}

/**
 * Require at least workspace member role. Returns error response or null if OK.
 */
export async function requireWorkspaceMember(
  authResult: AuthResult,
  workspaceId: string
): Promise<NextResponse | null> {
  if (!authResult.authenticated) return authResult.error!;

  // Dev bypass has no userId — allow everything
  if (!authResult.userId) return null;

  // Global admin from AuthResult is already sufficient
  if (authResult.role === "admin") return null;

  const effective = await getEffectiveRole(authResult.userId, workspaceId);
  if (effective === "viewer") {
    return NextResponse.json(
      { error: "Insufficient permissions. Member or admin role required in this workspace." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require workspace admin role. Returns error response or null if OK.
 */
export async function requireWorkspaceAdmin(
  authResult: AuthResult,
  workspaceId: string
): Promise<NextResponse | null> {
  if (!authResult.authenticated) return authResult.error!;

  // Dev bypass
  if (!authResult.userId) return null;

  if (authResult.role === "admin") return null;

  const effective = await getEffectiveRole(authResult.userId, workspaceId);
  if (effective !== "admin") {
    return NextResponse.json(
      { error: "Admin access required in this workspace." },
      { status: 403 }
    );
  }
  return null;
}
