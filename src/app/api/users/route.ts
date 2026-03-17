import { NextRequest, NextResponse } from "next/server";
import { listUsers } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/users — list all users (admin only)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const allUsers = await listUsers();

  // Don't expose sensitive fields
  const safeUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    isAdmin: u.isAdmin,
  }));

  return NextResponse.json(safeUsers);
}
