import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";
import { eq, and } from "drizzle-orm";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { decrypt } from "@/lib/encryption";
import { revokeToken } from "@/lib/gmail";

// DELETE /api/email-connections/:id — disconnect and revoke token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { id } = await params;

  // Only the owning user can delete their connection
  const [connection] = await db
    .select()
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

  // Revoke the Google token (best-effort)
  try {
    const refreshToken = decrypt(connection.refreshToken);
    await revokeToken(refreshToken);
  } catch {
    // Token revocation is best-effort — continue with deletion
  }

  // Delete the connection (cascades to email_contact_settings)
  await db
    .delete(emailConnections)
    .where(eq(emailConnections.id, id));

  return NextResponse.json({ success: true });
}
