import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connections } from "@/db/schema/connections";
import { eq } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getConnector } from "@/lib/connectors";
import { decryptCredentials } from "@/lib/credentials-encryption";

type Params = { params: Promise<{ id: string }> };

// POST /api/connections/:id/test — test the connection
export async function POST(request: NextRequest, { params }: Params) {
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

  try {
    const connector = getConnector(
      connection.connectorType as Parameters<typeof getConnector>[0]
    );
    const credentials = decryptCredentials(connection.credentials);
    const message = await connector.testConnection(credentials);

    await db
      .update(connections)
      .set({
        status: "connected",
        statusMessage: message,
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(connections.id, id));

    return NextResponse.json({ success: true, message });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await db
      .update(connections)
      .set({
        status: "error",
        statusMessage: errorMsg,
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(connections.id, id));

    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
  }
}
