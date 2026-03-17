import { NextRequest, NextResponse } from "next/server";
import { deleteApiKey } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/api-keys/:id — revoke an API key (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const deleted = await deleteApiKey(id);

  if (!deleted) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
