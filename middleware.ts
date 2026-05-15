import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./lib/session";
import {
  SESSION_COOKIE_NAME,
  PUBLIC_ROUTES,
  DECOY_ALLOWED_ROUTES,
} from "./lib/constants";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  ) {
    // /api/health, /api/admin/* and /api/cron/* enforce their own bearer auth.
    return NextResponse.next();
  }

  // Allow public routes without session
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Verify session cookie
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const session = await verifySession(token);
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // DECOY mode: hard-block all DV routes
  if (session.mode === "DECOY") {
    const allowed = DECOY_ALLOWED_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    );
    if (!allowed) {
      // Silent redirect — never reveal that restricted routes exist
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // FULL mode: inject session info into headers for server components
  const res = NextResponse.next();
  res.headers.set("x-session-user-id", session.userId);
  res.headers.set("x-session-mode", session.mode);
  res.headers.set("x-session-email", session.email);
  res.headers.set("x-session-salt", session.passwordSalt);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
  ],
};
