import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { addJob } from "@/lib/worker-client";

const SYNC_COOLDOWN_MS = 60_000; // 1 minute cooldown between manual syncs

// POST /api/email-connections/:id/refresh — trigger manual email sync
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { id } = await params;

  // Verify ownership
  const [connection] = await db
    .select({
      id: emailConnections.id,
      status: emailConnections.status,
      lastSyncedAt: emailConnections.lastSyncedAt,
    })
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.id, id),
        eq(emailConnections.userId, authResult.userId!)
      )
    );

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  if (connection.status !== "connected") {
    return NextResponse.json(
      { error: "Connection is not active. Please reconnect your account." },
      { status: 400 }
    );
  }

  // Rate limit: reject if last sync was less than cooldown period ago
  if (connection.lastSyncedAt) {
    const elapsed = Date.now() - new Date(connection.lastSyncedAt).getTime();
    if (elapsed < SYNC_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before syncing again.` },
        { status: 429 }
      );
    }
  }

  await addJob("sync_email_interactions", {
    emailConnectionId: id,
    triggeredBy: "manual",
  });

  return NextResponse.json({ queued: true });
}
