import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { addJob } from "@/lib/worker-client";

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
    .select({ id: emailConnections.id, status: emailConnections.status })
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

  await addJob("sync_email_interactions", {
    emailConnectionId: id,
    triggeredBy: "manual",
  });

  return NextResponse.json({ queued: true });
}
