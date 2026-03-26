import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { getEffectiveRole } from "@/lib/workspaces";
import { getTicketStats } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const effectiveRole = await getEffectiveRole(authResult.userId!, workspaceId);

  if (effectiveRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const stats = await getTicketStats(workspaceId);
  return NextResponse.json(stats);
}
