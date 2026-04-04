import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listCampaigns, createCampaign } from "@/lib/campaigns";
import { validateBody } from "@/lib/api-validate";
import { CreateCampaignInput } from "@/lib/schemas";
import { getActiveWorkspaceId } from "@/lib/workspace-context";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const workspaceId = await getActiveWorkspaceId(request);
  const campaigns = await listCampaigns(workspaceId);
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const workspaceId = await getActiveWorkspaceId(request);
  const body = await request.json();
  const parsed = validateBody(CreateCampaignInput, body);
  if (!parsed.success) return parsed.error;

  const campaign = await createCampaign({
    name: parsed.data.name,
    subject: parsed.data.subject,
    body: parsed.data.body,
    fromName: parsed.data.fromName ?? undefined,
    fromEmail: parsed.data.fromEmail ?? undefined,
    segmentId: parsed.data.segmentId ?? undefined,
    categoryId: parsed.data.categoryId,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    createdBy: authResult.userId,
    workspaceId,
    allowNoUnsubscribe: parsed.data.allowNoUnsubscribe,
  });

  return NextResponse.json(campaign, { status: 201 });
}
