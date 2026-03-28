import { NextRequest, NextResponse } from "next/server";
import { checkAuth, requireAuth } from "@/lib/api-auth";
import { buildGmailAuthUrl } from "@/lib/gmail";
import { randomBytes } from "crypto";

// GET /api/auth/gmail — initiate Gmail OAuth flow
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;

  // Generate state token for CSRF protection (includes userId + random nonce)
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ userId: authResult.userId, nonce })
  ).toString("base64url");

  const authUrl = buildGmailAuthUrl(state);

  // Set state cookie for verification in callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
