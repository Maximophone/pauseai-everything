import { NextRequest, NextResponse } from "next/server";
import { listUsers, inviteUser } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { InviteUserInput } from "@/lib/schemas";
import { auth } from "@/lib/auth";

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
    role: u.role,
  }));

  return NextResponse.json(safeUsers);
}

// POST /api/users — invite a new user (admin only)
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(InviteUserInput, body);
  if (!parsed.success) return parsed.error;

  // Get inviter's name for the email
  const session = await auth();
  const inviterName = session?.user?.name || undefined;

  const { user, alreadyExists } = await inviteUser(
    parsed.data.email,
    parsed.data.role,
    inviterName
  );

  if (alreadyExists) {
    return NextResponse.json(
      { error: "A user with this email already exists." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    { status: 201 }
  );
}
