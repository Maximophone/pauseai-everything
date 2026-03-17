import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // In development, skip auth entirely
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (JWT-based)
  // The actual session validation happens in server components/API routes
  // Middleware just does a lightweight redirect check
  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("authjs.session-token");
  const isLoggedIn = !!sessionCookie;

  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = req.nextUrl.pathname === "/login";

  // Redirect logged-in users away from login page
  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Protect dashboard routes
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
