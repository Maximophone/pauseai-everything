import { NextRequest, NextResponse } from "next/server";
import { inviteUser } from "@/lib/users";
import { checkAuth } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { InviteUserInput } from "@/lib/schemas";
import { auth } from "@/lib/auth";
import { getActiveWorkspaceId, requireWorkspaceAdmin } from "@/lib/workspace-context";
import { getWorkspaceMembers, addUserToWorkspace } from "@/lib/workspaces";

// GET /api/users — list members of the active workspace (workspace admin only)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const members = await getWorkspaceMembers(workspaceId);

  const safeUsers = members.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    image: m.image,
    role: m.role, // This is the workspace role
    globalRole: m.globalRole,
  }));

  return NextResponse.json(safeUsers);
}

// POST /api/users — invite a user to the active workspace (workspace admin only)
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const workspaceId = await getActiveWorkspaceId(request);
  const adminError = await requireWorkspaceAdmin(authResult, workspaceId);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(InviteUserInput, body);
  if (!parsed.success) return parsed.error;

  // Get inviter's name for the email
  const session = await auth();
  const inviterName = session?.user?.name || undefined;

  // Create or find the user (sets their global role)
  const { user, alreadyExists } = await inviteUser(
    parsed.data.email,
    parsed.data.role,
    inviterName
  );

  // Add user to the active workspace with the specified role
  await addUserToWorkspace(user.id, workspaceId, parsed.data.role);

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      role: parsed.data.role,
      addedToWorkspace: true,
      alreadyExisted: alreadyExists,
    },
    { status: 201 }
  );
}
