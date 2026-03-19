import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { sendPreviewEmail } from "@/lib/campaigns";
import { validateBody } from "@/lib/api-validate";
import { CampaignPreviewInput } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(CampaignPreviewInput, body);
  if (!parsed.success) return parsed.error;

  try {
    const result = await sendPreviewEmail(id, parsed.data.email);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
