import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { desc, eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

// GET /api/email-connections — list current user's connections
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const workspaceId = await getActiveWorkspaceId(request);

  const rows = await db
    .select({
      id: emailConnections.id,
      provider: emailConnections.provider,
      providerAccountEmail: emailConnections.providerAccountEmail,
      defaultSyncInteractions: emailConnections.defaultSyncInteractions,
      defaultInteractionsVisible: emailConnections.defaultInteractionsVisible,
      syncIntervalMinutes: emailConnections.syncIntervalMinutes,
      lastSyncedAt: emailConnections.lastSyncedAt,
      status: emailConnections.status,
      statusMessage: emailConnections.statusMessage,
      createdAt: emailConnections.createdAt,
    })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.userId, authResult.userId!),
        eq(emailConnections.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(emailConnections.createdAt));

  return NextResponse.json(rows);
}
