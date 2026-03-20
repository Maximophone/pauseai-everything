import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { addJob } from "@/lib/worker-client";

type Params = { params: Promise<{ id: string; syncId: string }> };

// POST /api/connections/:id/syncs/:syncId/run — trigger a manual sync
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await checkAuth(request);
  const authError = requireAdmin(authResult);
  if (authError) return authError;

  const { syncId } = await params;

  await addJob("run_sync", {
    syncConfigurationId: syncId,
    triggeredBy: "manual",
  });

  return NextResponse.json({ success: true, message: "Sync job queued" });
}
