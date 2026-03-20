import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connections, syncConfigurations } from "@/db/schema/connections";
import { eq, desc } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateSyncConfigInput } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

// GET /api/connections/:id/syncs — list sync configurations
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id } = await params;

  // Verify connection exists
  const [connection] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.id, id));

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const syncs = await db
    .select()
    .from(syncConfigurations)
    .where(eq(syncConfigurations.connectionId, id))
    .orderBy(desc(syncConfigurations.createdAt));

  return NextResponse.json(syncs);
}

// POST /api/connections/:id/syncs — create sync configuration
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id } = await params;

  // Verify connection exists
  const [connection] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.id, id));

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = validateBody(CreateSyncConfigInput, body);
  if (!parsed.success) return parsed.error;

  const [syncConfig] = await db
    .insert(syncConfigurations)
    .values({
      connectionId: id,
      name: parsed.data.name,
      externalResource: parsed.data.externalResource,
      fieldMapping: parsed.data.fieldMapping,
      externalSchema: parsed.data.externalSchema || [],
      syncFrequency: parsed.data.syncFrequency,
      duplicateStrategy: parsed.data.duplicateStrategy,
    })
    .returning();

  return NextResponse.json(syncConfig, { status: 201 });
}
