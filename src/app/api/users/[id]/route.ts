import { NextRequest, NextResponse } from "next/server";
import { updateUserRole, getUser, deleteUser } from "@/lib/users";
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

  // Prevent admins from demoting themselves
  if (id === authResult.userId && parsed.data.role !== "admin") {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  const updated = await updateUserRole(id, parsed.data.role);
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
  });
}

// DELETE /api/users/:id — remove a user (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const { id } = await context.params;

  // Prevent admins from deleting themselves
  if (id === authResult.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const user = await getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await deleteUser(id);
  return NextResponse.json({ success: true });
}
