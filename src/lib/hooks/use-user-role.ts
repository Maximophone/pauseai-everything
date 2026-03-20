"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@/db/schema/users";

/**
 * Get the current user's role from the session.
 * Returns "viewer" as default if session is loading or unavailable.
 */
export function useUserRole(): UserRole {
  const { data: session } = useSession();
  // @ts-expect-error - role is added in auth callbacks
  return (session?.user?.role as UserRole) ?? "viewer";
}

/**
 * Check if the current user has at least the given role.
 */
export function useHasRole(minRole: UserRole): boolean {
  const role = useUserRole();
  const hierarchy: UserRole[] = ["viewer", "member", "admin"];
  return hierarchy.indexOf(role) >= hierarchy.indexOf(minRole);
}
