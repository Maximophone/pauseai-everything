import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { syncRuns } from "@/db/schema/connections";
import { eq, desc } from "drizzle-orm";
import { checkAuth, requireAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; syncId: string }> };

// GET /api/connections/:id/syncs/:syncId/runs — list sync runs
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { syncId } = await params;

  const runs = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.syncConfigurationId, syncId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(50);

  return NextResponse.json(runs);
}
