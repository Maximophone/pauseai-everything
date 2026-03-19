import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listCampaigns, createCampaign } from "@/lib/campaigns";
import { validateBody } from "@/lib/api-validate";
import { CreateCampaignInput } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) return authResult.error!;

  const campaigns = await listCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

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
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    createdBy: authResult.userId,
  });

  return NextResponse.json(campaign, { status: 201 });
}
