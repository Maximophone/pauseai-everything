import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { getCampaign, updateCampaign, deleteCampaign } from "@/lib/campaigns";
import { validateBody, stripNulls } from "@/lib/api-validate";
import { UpdateCampaignInput } from "@/lib/schemas";
import { getActiveWorkspaceId, requireWorkspaceMember } from "@/lib/workspace-context";
import { getSegment } from "@/lib/segments";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const authError = await requireWorkspaceMember(authResult, workspaceId);
  if (authError) return authError;

  const { id } = await context.params;
  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateCampaignInput, body);
  if (!parsed.success) return parsed.error;

  // Validate segmentId belongs to the campaign's workspace
  if (parsed.data.segmentId) {
    const campaign = await getCampaign(id);
    if (campaign) {
      const segment = await getSegment(parsed.data.segmentId);
      if (!segment) {
        return NextResponse.json({ error: "Segment not found." }, { status: 400 });
      }
      if (segment.workspaceId !== campaign.workspaceId) {
        return NextResponse.json(
          { error: "Segment does not belong to this workspace." },
          { status: 400 }
        );
      }
    }
  }

  // categoryId: null is meaningful (= transactional), segmentId: null means "all contacts"
  const { categoryId, segmentId, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = stripNulls(rest);
  if (categoryId !== undefined) updateData.categoryId = categoryId;
  if (segmentId !== undefined) updateData.segmentId = segmentId;
  const updated = await updateCampaign(id, updateData as Parameters<typeof updateCampaign>[1]);
  if (!updated) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteCampaign(id);
  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
