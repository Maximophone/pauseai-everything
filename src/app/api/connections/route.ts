import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connections } from "@/db/schema/connections";
import { desc } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateConnectionInput } from "@/lib/schemas";
import { getConnector } from "@/lib/connectors";

// GET /api/connections — list all connections
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const rows = await db
    .select({
      id: connections.id,
      name: connections.name,
      connectorType: connections.connectorType,
      status: connections.status,
      statusMessage: connections.statusMessage,
      lastTestedAt: connections.lastTestedAt,
      createdAt: connections.createdAt,
      updatedAt: connections.updatedAt,
    })
    .from(connections)
    .orderBy(desc(connections.createdAt));

  return NextResponse.json(rows);
}

// POST /api/connections — create a connection
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const body = await request.json();
  const parsed = validateBody(CreateConnectionInput, body);
  if (!parsed.success) return parsed.error;

  // Validate connector type is available
  try {
    getConnector(parsed.data.connectorType);
  } catch {
    return NextResponse.json(
      { error: `Connector type "${parsed.data.connectorType}" is not yet available` },
      { status: 400 }
    );
  }

  const [connection] = await db
    .insert(connections)
    .values({
      name: parsed.data.name,
      connectorType: parsed.data.connectorType,
      credentials: parsed.data.credentials,
    })
    .returning();

  return NextResponse.json(connection, { status: 201 });
}
