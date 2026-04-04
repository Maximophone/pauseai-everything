import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sandboxEmails } from "@/db/schema/sandbox-emails";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getEmailMode } from "@/lib/mailersend";
import { eq } from "drizzle-orm";

/**
 * GET /api/sandbox/emails/:id — Get a single sandbox email with full detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (getEmailMode() !== "sandbox") {
    return NextResponse.json(
      { error: "Sandbox endpoints are only available when EMAIL_MODE=sandbox" },
      { status: 404 }
    );
  }

  const authResult = await checkAuth(request);
  const adminCheck = requireAdmin(authResult);
  if (adminCheck) return adminCheck;

  const { id } = await params;
  const [email] = await db
    .select()
    .from(sandboxEmails)
    .where(eq(sandboxEmails.id, id));

  if (!email) {
    return NextResponse.json({ error: "Sandbox email not found" }, { status: 404 });
  }

  return NextResponse.json(email);
}
