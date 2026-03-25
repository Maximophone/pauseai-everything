"use client";

import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/workspace-provider";
import type { UserRole } from "@/db/schema/users";

const ROLE_LEVELS: Record<string, number> = { viewer: 0, member: 1, admin: 2 };
const LEVEL_TO_ROLE: UserRole[] = ["viewer", "member", "admin"];

/**
 * Get the current user's global role from the session.
 */
export function useUserRole(): UserRole {
  const { data: session } = useSession();
  // @ts-expect-error - role is added in auth callbacks
  return (session?.user?.role as UserRole) ?? "viewer";
}

/**
 * Get the current user's effective role in the active workspace.
 * Effective role = max(global role, workspace role).
 */
export function useEffectiveRole(): UserRole {
  const globalRole = useUserRole();
  const { activeWorkspace } = useWorkspace();
  const globalLevel = ROLE_LEVELS[globalRole] ?? 0;
  const wsLevel = ROLE_LEVELS[activeWorkspace?.workspaceRole ?? "viewer"] ?? 0;
  return LEVEL_TO_ROLE[Math.max(globalLevel, wsLevel)];
}

/**
 * Check if the current user has at least the given role in the active workspace.
 * Uses the effective role (max of global and workspace role).
 */
export function useHasRole(minRole: UserRole): boolean {
  const effectiveRole = useEffectiveRole();
  const hierarchy: UserRole[] = ["viewer", "member", "admin"];
  return hierarchy.indexOf(effectiveRole) >= hierarchy.indexOf(minRole);
}
