import { NextRequest, NextResponse } from "next/server";
import { updateUserRole, getUser } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { UpdateUserInput } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/users/:id — update user role (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = validateBody(UpdateUserInput, body);
  if (!parsed.success) return parsed.error;

  const user = await getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const updated = await updateUserRole(id, parsed.data.isAdmin);
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    isAdmin: updated.isAdmin,
  });
}
