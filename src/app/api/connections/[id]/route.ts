import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connections } from "@/db/schema/connections";
import { eq } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateConnectionInput } from "@/lib/schemas";
import { decryptCredentials, encryptCredentials } from "@/lib/credentials-encryption";

type Params = { params: Promise<{ id: string }> };

// GET /api/connections/:id
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, id));

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Decrypt credentials before returning
  return NextResponse.json({
    ...connection,
    credentials: decryptCredentials(connection.credentials),
  });
}

// PUT /api/connections/:id
export async function PUT(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const parsed = validateBody(UpdateConnectionInput, body);
  if (!parsed.success) return parsed.error;

  // Encrypt credentials if provided
  const dataToSet = {
    ...parsed.data,
    ...(parsed.data.credentials
      ? { credentials: encryptCredentials(parsed.data.credentials) }
      : {}),
    status: "untested", // reset status when credentials change
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(connections)
    .set(dataToSet)
    .where(eq(connections.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/connections/:id
export async function DELETE(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { id } = await params;
  const result = await db
    .delete(connections)
    .where(eq(connections.id, id))
    .returning({ id: connections.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
