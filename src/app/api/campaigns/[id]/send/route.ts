import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getCampaign, updateCampaign, sendCampaign } from "@/lib/campaigns";
import { addJob } from "@/lib/worker-client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;

  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Campaign already sent or sending." }, { status: 400 });
  }

  // Try to queue via worker; fall back to synchronous send
  try {
    await addJob("send_campaign", { campaignId: id });
    await updateCampaign(id, { status: "sending" });
    return NextResponse.json({ queued: true, message: "Campaign queued for sending." });
  } catch {
    // Worker not running — send synchronously
    try {
      const result = await sendCampaign(id);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
}
