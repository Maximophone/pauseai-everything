import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connections } from "@/db/schema/connections";
import { eq } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getConnector } from "@/lib/connectors";
import { decryptCredentials } from "@/lib/credentials-encryption";

type Params = { params: Promise<{ id: string }> };

// GET /api/connections/:id/resources/schema?baseId=...&tableId=...
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

  // Build resource object from query params
  const searchParams = request.nextUrl.searchParams;
  const resource: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    resource[key] = value;
  }

  try {
    const connector = getConnector(
      connection.connectorType as Parameters<typeof getConnector>[0]
    );
    const credentials = decryptCredentials(connection.credentials);
    const schema = await connector.getSchema(credentials, resource);
    return NextResponse.json(schema);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
