import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/dashboard";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const stats = await getDashboardStats(workspaceId);
  return NextResponse.json(stats);
}
