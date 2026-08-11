// ============================================================
// LEGALIR — Next.js Middleware (Route Protection)
// ============================================================
// Runs at the edge before every navigation.
// Redirects unauthenticated users away from protected routes.
// Preserves the intended route as ?intent=<path> for post-login redirect.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes that require authentication */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/new",
  "/chat",
  "/documents",
  "/contracts",
  "/history",
  "/memory",
  "/subscription",
  "/profile",
  "/settings",
  "/services",
  "/support",
];

/** Routes accessible only to unauthenticated users (redirect to dashboard if logged in) */
const GUEST_ONLY_PREFIXES = ["/auth/mobile", "/auth/verify", "/login", "/register"];

/** Public routes accessible by anyone */
const PUBLIC_PREFIXES = ["/", "/pricing", "/features", "/about", "/contact", "/health", "/design-system"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isGuestOnly(pathname: string): boolean {
  return GUEST_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public and static assets through
  if (isPublic(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check for session cookie (set by the auth API / MSW handler)
  // In dev mode with MSW, the auth-store manages session client-side in localStorage.
  // The middleware primarily handles the UX of redirect + intent preservation.
  // MSW-based sessions are read from localStorage, which isn't accessible in middleware.
  //
  // For Phase 4 we use a session cookie approach alongside the Zustand store.
  const sessionCookie = request.cookies.get("legalir-session");

  // --- Protected routes: redirect to login if not authenticated ---
  if (isProtected(pathname)) {
    if (!sessionCookie) {
      // Preserve the intended route
      const loginUrl = new URL("/auth/mobile", request.url);
      if (pathname !== "/dashboard") {
        loginUrl.searchParams.set("intent", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // --- Guest-only routes: redirect to dashboard if already authenticated ---
  if (isGuestOnly(pathname)) {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // --- Auth flow routes: allow through, but process intent ---
  if (pathname === "/auth/verify") {
    // Intent is preserved via the ?mobile= param and auth store
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mockServiceWorker.js|.*\\.svg$|.*\\.png$).*)",
  ],
};
