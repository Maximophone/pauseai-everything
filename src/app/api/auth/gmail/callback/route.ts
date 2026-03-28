import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { encrypt } from "@/lib/encryption";
import { db } from "@/db";
import { emailConnections } from "@/db/schema/email-connections";

// GET /api/auth/gmail/callback — handle Google OAuth callback
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectBase = `${appUrl}/dashboard/my-email-contacts`;

  if (error) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Missing code or state parameter")}`
    );
  }

  // Verify state cookie
  const savedState = request.cookies.get("gmail_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Invalid state parameter — possible CSRF attack")}`
    );
  }

  // Verify the state contains the correct userId and extract workspaceId
  let workspaceId: string;
  try {
    const stateData = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );
    if (stateData.userId !== authResult.userId) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent("User mismatch in OAuth state")}`
      );
    }
    if (!stateData.workspaceId) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent("Missing workspace in OAuth state")}`
      );
    }
    workspaceId = stateData.workspaceId;
  } catch {
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Invalid state format")}`
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Upsert: if connection already exists for this user+provider+email, update it
    await db
      .insert(emailConnections)
      .values({
        userId: authResult.userId!,
        workspaceId,
        provider: "gmail",
        providerAccountEmail: tokens.email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        status: "connected",
        statusMessage: null,
      })
      .onConflictDoUpdate({
        target: [
          emailConnections.userId,
          emailConnections.provider,
          emailConnections.providerAccountEmail,
        ],
        set: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          status: "connected",
          statusMessage: null,
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.redirect(
      `${redirectBase}?connected=true`
    );
    // Clear the state cookie
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent("Failed to connect Gmail account. Please try again.")}`
    );
  }
}
