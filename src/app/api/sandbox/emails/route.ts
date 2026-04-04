import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sandboxEmails } from "@/db/schema/sandbox-emails";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getEmailMode } from "@/lib/mailersend";
import { eq, and, gte, sql, desc } from "drizzle-orm";

function requireSandboxMode(): NextResponse | null {
  if (getEmailMode() !== "sandbox") {
    return NextResponse.json(
      { error: "Sandbox endpoints are only available when EMAIL_MODE=sandbox" },
      { status: 404 }
    );
  }
  return null;
}

/**
 * GET /api/sandbox/emails — List sandbox emails with optional filters.
 */
export async function GET(request: NextRequest) {
  const sandboxCheck = requireSandboxMode();
  if (sandboxCheck) return sandboxCheck;

  const authResult = await checkAuth(request);
  const adminCheck = requireAdmin(authResult);
  if (adminCheck) return adminCheck;

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const toEmail = url.searchParams.get("to");
  const workspaceId = url.searchParams.get("workspaceId");
  const status = url.searchParams.get("status");
  const since = url.searchParams.get("since");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const conditions = [];
  if (campaignId) conditions.push(eq(sandboxEmails.campaignId, campaignId));
  if (toEmail) conditions.push(eq(sandboxEmails.toEmail, toEmail));
  if (workspaceId) conditions.push(eq(sandboxEmails.workspaceId, workspaceId));
  if (status) conditions.push(eq(sandboxEmails.status, status));
  if (since) conditions.push(gte(sandboxEmails.createdAt, new Date(since)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [emailRows, countResult] = await Promise.all([
    db
      .select()
      .from(sandboxEmails)
      .where(where)
      .orderBy(desc(sandboxEmails.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(sandboxEmails)
      .where(where),
  ]);

  return NextResponse.json({
    emails: emailRows,
    total: Number(countResult[0].count),
  });
}

/**
 * DELETE /api/sandbox/emails — Clear sandbox emails.
 * Optional body: { campaignId: "..." } to scope deletion.
 */
export async function DELETE(request: NextRequest) {
  const sandboxCheck = requireSandboxMode();
  if (sandboxCheck) return sandboxCheck;

  const authResult = await checkAuth(request);
  const adminCheck = requireAdmin(authResult);
  if (adminCheck) return adminCheck;

  let campaignId: string | undefined;
  try {
    const body = await request.json();
    campaignId = body?.campaignId;
  } catch {
    // No body or invalid JSON — delete everything
  }

  let result;
  if (campaignId) {
    result = await db
      .delete(sandboxEmails)
      .where(eq(sandboxEmails.campaignId, campaignId))
      .returning({ id: sandboxEmails.id });
  } else {
    result = await db
      .delete(sandboxEmails)
      .returning({ id: sandboxEmails.id });
  }

  return NextResponse.json({ deleted: result.length });
}
