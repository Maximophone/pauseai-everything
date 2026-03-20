import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { syncConfigurations } from "@/db/schema/connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateSyncConfigInput } from "@/lib/schemas";

type Params = { params: Promise<{ id: string; syncId: string }> };

// GET /api/connections/:id/syncs/:syncId
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id, syncId } = await params;
  const [config] = await db
    .select()
    .from(syncConfigurations)
    .where(
      and(
        eq(syncConfigurations.id, syncId),
        eq(syncConfigurations.connectionId, id)
      )
    );

  if (!config) {
    return NextResponse.json({ error: "Sync configuration not found" }, { status: 404 });
  }

  return NextResponse.json(config);
}

// PUT /api/connections/:id/syncs/:syncId
export async function PUT(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id, syncId } = await params;
  const body = await request.json();
  const parsed = validateBody(UpdateSyncConfigInput, body);
  if (!parsed.success) return parsed.error;

  // If field mapping is updated and status was needs_repair, reset to active
  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  if (parsed.data.fieldMapping && parsed.data.status === undefined) {
    // Check if current status is needs_repair — if so, reset to active
    const [current] = await db
      .select({ status: syncConfigurations.status })
      .from(syncConfigurations)
      .where(eq(syncConfigurations.id, syncId));

    if (current?.status === "needs_repair") {
      updateData.status = "active";
      updateData.statusMessage = null;
    }
  }

  const [updated] = await db
    .update(syncConfigurations)
    .set(updateData)
    .where(
      and(
        eq(syncConfigurations.id, syncId),
        eq(syncConfigurations.connectionId, id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Sync configuration not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/connections/:id/syncs/:syncId
export async function DELETE(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id, syncId } = await params;
  const result = await db
    .delete(syncConfigurations)
    .where(
      and(
        eq(syncConfigurations.id, syncId),
        eq(syncConfigurations.connectionId, id)
      )
    )
    .returning({ id: syncConfigurations.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Sync configuration not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
