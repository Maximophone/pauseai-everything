import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/users";
import type { UserRole } from "@/db/schema/users";

export type AuthResult = {
  authenticated: boolean;
  userId?: string;
  role?: UserRole;
  error?: NextResponse;
};

/**
 * Check authentication for API routes.
 * Supports both session auth (browser) and API key auth (machine-to-machine).
 */
export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  // Check for API key in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer pai_")) {
    const key = authHeader.slice(7);
    const apiKey = await validateApiKey(key);
    if (apiKey) {
      return { authenticated: true, userId: apiKey.userId, role: "admin" };
    }
    return {
      authenticated: false,
      error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  // Check session auth (works for both Google OAuth and dev login)
  const session = await auth();
  if (session?.user?.id) {
    return {
      authenticated: true,
      userId: session.user.id,
      // @ts-expect-error - role is added in auth callbacks
      role: (session.user.role as UserRole) ?? "viewer",
    };
  }

  // Check dev bypass (fallback when no session)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "true"
  ) {
    // Try to find a real user to use as the dev identity
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema/users");
    const [devUser] = await db.select({ id: users.id }).from(users).limit(1);
    return { authenticated: true, userId: devUser?.id, role: "admin" };
  }

  return {
    authenticated: false,
    error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
  };
}

/**
 * Require admin role. Returns error response if not admin, null if OK.
 */
export function requireAdmin(authResult: AuthResult): NextResponse | null {
  if (!authResult.authenticated) return authResult.error!;
  if (authResult.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

/**
 * Require at least member role (member or admin).
 * Viewers are rejected.
 */
export function requireMember(authResult: AuthResult): NextResponse | null {
  if (!authResult.authenticated) return authResult.error!;
  if (authResult.role === "viewer") {
    return NextResponse.json(
      { error: "Insufficient permissions. Member or admin role required." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require authentication (any role).
 */
export function requireAuth(authResult: AuthResult): NextResponse | null {
  if (!authResult.authenticated) return authResult.error!;
  return null;
}
