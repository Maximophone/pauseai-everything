import { db } from "@/db";
import {
  workspaces,
  userWorkspaces,
  contactWorkspaces,
  type Workspace,
} from "@/db/schema/workspaces";
import { users, type UserRole } from "@/db/schema/users";
import { eq, and, asc } from "drizzle-orm";

// ── Cache for Global workspace ID ───────────────────────────

let _globalWorkspaceId: string | null = null;

export async function getGlobalWorkspace(): Promise<Workspace> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.type, "global"))
    .limit(1);

  if (!ws) throw new Error("Global workspace not found. Run db:seed first.");
  _globalWorkspaceId = ws.id;
  return ws;
}

export async function getGlobalWorkspaceId(): Promise<string> {
  if (_globalWorkspaceId) return _globalWorkspaceId;
  const ws = await getGlobalWorkspace();
  return ws.id;
}

// ── Workspace CRUD ──────────────────────────────────────────

export async function listWorkspaces(): Promise<Workspace[]> {
  return db.select().from(workspaces).orderBy(asc(workspaces.name));
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return ws ?? null;
}

export async function createWorkspace(data: {
  name: string;
  slug: string;
  type: "global" | "chapter";
  defaultLanguage?: string;
}): Promise<Workspace> {
  const [ws] = await db.insert(workspaces).values(data).returning();
  return ws;
}

export async function updateWorkspace(
  id: string,
  data: Partial<{ name: string; slug: string; defaultLanguage: string }>
): Promise<Workspace | null> {
  const [ws] = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning();
  return ws ?? null;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const result = await db
    .delete(workspaces)
    .where(eq(workspaces.id, id))
    .returning({ id: workspaces.id });
  return result.length > 0;
}

// ── User-Workspace membership ───────────────────────────────

export async function getUserWorkspaces(
  userId: string
): Promise<(Workspace & { workspaceRole: UserRole })[]> {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      type: workspaces.type,
      defaultLanguage: workspaces.defaultLanguage,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      workspaceRole: userWorkspaces.role,
    })
    .from(userWorkspaces)
    .innerJoin(workspaces, eq(userWorkspaces.workspaceId, workspaces.id))
    .where(eq(userWorkspaces.userId, userId))
    .orderBy(asc(workspaces.name));

  return result;
}

export async function addUserToWorkspace(
  userId: string,
  workspaceId: string,
  role: UserRole = "viewer"
) {
  await db
    .insert(userWorkspaces)
    .values({ userId, workspaceId, role })
    .onConflictDoNothing();
}

export async function updateUserWorkspaceRole(
  userId: string,
  workspaceId: string,
  role: UserRole
) {
  await db
    .update(userWorkspaces)
    .set({ role })
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.workspaceId, workspaceId)
      )
    );
}

export async function removeUserFromWorkspace(
  userId: string,
  workspaceId: string
) {
  await db
    .delete(userWorkspaces)
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.workspaceId, workspaceId)
      )
    );
}

export async function getWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      userId: userWorkspaces.userId,
      role: userWorkspaces.role,
      createdAt: userWorkspaces.createdAt,
      name: users.name,
      email: users.email,
      image: users.image,
      globalRole: users.role,
    })
    .from(userWorkspaces)
    .innerJoin(users, eq(userWorkspaces.userId, users.id))
    .where(eq(userWorkspaces.workspaceId, workspaceId))
    .orderBy(asc(users.name));
}

// ── Effective role ──────────────────────────────────────────

const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
};

const LEVEL_TO_ROLE: UserRole[] = ["viewer", "member", "admin"];

/**
 * Get the effective role for a user in a workspace.
 * Effective role = max(global role, workspace role).
 * Global admins can do anything in any workspace.
 */
export async function getEffectiveRole(
  userId: string,
  workspaceId: string
): Promise<UserRole> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return "viewer";

  const globalLevel = ROLE_LEVELS[user.role];

  // Global admin shortcut
  if (globalLevel >= 2) return "admin";

  const [membership] = await db
    .select({ role: userWorkspaces.role })
    .from(userWorkspaces)
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.workspaceId, workspaceId)
      )
    );

  const wsLevel = membership ? ROLE_LEVELS[membership.role] : 0;
  return LEVEL_TO_ROLE[Math.max(globalLevel, wsLevel)];
}

// ── Contact-Workspace membership ────────────────────────────

export async function addContactToWorkspace(
  contactId: string,
  workspaceId: string,
  subscriptionStatus: "subscribed" | "unsubscribed" | "neutral" = "neutral"
) {
  await db
    .insert(contactWorkspaces)
    .values({ contactId, workspaceId, subscriptionStatus })
    .onConflictDoNothing();
}

export async function removeContactFromWorkspace(
  contactId: string,
  workspaceId: string
) {
  await db
    .delete(contactWorkspaces)
    .where(
      and(
        eq(contactWorkspaces.contactId, contactId),
        eq(contactWorkspaces.workspaceId, workspaceId)
      )
    );
}

export async function getContactWorkspaceLink(
  contactId: string,
  workspaceId: string
) {
  const [link] = await db
    .select()
    .from(contactWorkspaces)
    .where(
      and(
        eq(contactWorkspaces.contactId, contactId),
        eq(contactWorkspaces.workspaceId, workspaceId)
      )
    );
  return link ?? null;
}

export async function isWorkspaceGlobal(workspaceId: string): Promise<boolean> {
  const ws = await getWorkspace(workspaceId);
  return ws?.type === "global";
}
