import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/users";

type AuthResult = {
  authenticated: boolean;
  userId?: string;
  isAdmin?: boolean;
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
      return { authenticated: true, userId: apiKey.userId, isAdmin: true };
    }
    return {
      authenticated: false,
      error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  // Check dev bypass
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "true"
  ) {
    return { authenticated: true, userId: undefined, isAdmin: true };
  }

  // Check session auth
  const session = await auth();
  if (!session?.user?.id) {
    return {
      authenticated: false,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return {
    authenticated: true,
    userId: session.user.id,
    // @ts-expect-error - isAdmin is added in auth callbacks
    isAdmin: session.user.isAdmin ?? false,
  };
}

export function requireAdmin(authResult: AuthResult): NextResponse | null {
  if (!authResult.authenticated) return authResult.error!;
  if (!authResult.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}
