import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "better-auth/cookies";

// Protected route prefixes
const PROTECTED = ["/dashboard", "/presence", "/tasks", "/clocks"];
const AUTH_ROUTES = ["/login", "/magic-link"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route needs protection
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  // Extract session token from cookie
  const sessionCookie =
    request.cookies.get("teambase.session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value;

  const hasSession = Boolean(sessionCookie);

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png).*)",
  ],
};
