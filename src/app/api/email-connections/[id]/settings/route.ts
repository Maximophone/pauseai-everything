import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateEmailConnectionSettingsInput } from "@/lib/schemas";

// PUT /api/email-connections/:id/settings — update defaults
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { id } = await params;

  const body = await request.json();
  const parsed = validateBody(UpdateEmailConnectionSettingsInput, body);
  if (!parsed.success) return parsed.error;

  // Only the owning user can update their connection
  const [connection] = await db
    .select({ id: emailConnections.id })
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

  const [updated] = await db
    .update(emailConnections)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(emailConnections.id, id))
    .returning({
      id: emailConnections.id,
      defaultSyncInteractions: emailConnections.defaultSyncInteractions,
      defaultInteractionsVisible: emailConnections.defaultInteractionsVisible,
      syncIntervalMinutes: emailConnections.syncIntervalMinutes,
    });

  return NextResponse.json(updated);
}
