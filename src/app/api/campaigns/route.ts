import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { listCampaigns, createCampaign } from "@/lib/campaigns";

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
  const { name, subject, body: emailBody, fromName, fromEmail, segmentId } = body;

  if (!name || !subject || !emailBody) {
    return NextResponse.json(
      { error: "name, subject, and body are required." },
      { status: 400 }
    );
  }

  const campaign = await createCampaign({
    name,
    subject,
    body: emailBody,
    fromName,
    fromEmail,
    segmentId,
    createdBy: authResult.userId,
  });

  return NextResponse.json(campaign, { status: 201 });
}
