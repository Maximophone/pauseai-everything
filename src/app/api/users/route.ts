import { NextRequest, NextResponse } from "next/server";
import { listUsers, inviteUser } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { InviteUserInput } from "@/lib/schemas";
import { auth } from "@/lib/auth";
import { getActiveWorkspaceId } from "@/lib/workspace-context";
import { getWorkspaceMembers } from "@/lib/workspaces";
import { db } from "@/db";
import { userWorkspaces, workspaces } from "@/db/schema/workspaces";
import { eq } from "drizzle-orm";

// GET /api/users — list all users (admin only)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const allUsers = await listUsers();

  // Fetch workspace memberships for all users
  const allMemberships = await db
    .select({
      userId: userWorkspaces.userId,
      workspaceId: userWorkspaces.workspaceId,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
      role: userWorkspaces.role,
    })
    .from(userWorkspaces)
    .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id));

  const membershipMap = new Map<string, Array<{ workspaceId: string; workspaceName: string; workspaceType: string; role: string }>>();
  for (const m of allMemberships) {
    const existing = membershipMap.get(m.userId) || [];
    existing.push({ workspaceId: m.workspaceId, workspaceName: m.workspaceName, workspaceType: m.workspaceType, role: m.role });
    membershipMap.set(m.userId, existing);
  }

  const safeUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    workspaces: membershipMap.get(u.id) || [],
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
