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
  "/Suggest_law",
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
  "/calculators",
  "/lawyer",
  "/consultations",
  "/onboarding",
  // The platform admin panel. Middleware only guarantees a session exists;
  // STAFF authorization is enforced inside the shell (UX) and, authoritatively,
  // on every `/api/v1/admin/**` request server-side (lib/rbac.ts).
  "/admin",
];

/** Routes accessible only to unauthenticated users (redirect to dashboard if logged in) */
const GUEST_ONLY_PREFIXES = ["/auth/mobile", "/auth/verify", "/login", "/register"];

/**
 * The admin panel is also reachable on a dedicated subdomain — e.g.
 * `http://admin.localhost:3000` — which maps onto the `/admin` tree. Browsers
 * resolve `*.localhost` to 127.0.0.1, so no host-file edit is needed.
 */
const ADMIN_HOST_PREFIX = "admin.";

function isAdminHost(hostHeader: string | null): boolean {
  const hostname = (hostHeader ?? "").split(":")[0] ?? "";
  return hostname.startsWith(ADMIN_HOST_PREFIX);
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isGuestOnly(pathname: string): boolean {
  return GUEST_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostHeader = request.headers.get("host");
  const onAdminHost = isAdminHost(hostHeader);

  // Allow static assets through. `/api/**` is excluded by the matcher, but
  // keep the guard explicit for clarity.
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // On the admin subdomain, the whole surface maps onto the `/admin` tree.
  // Compute the effective path so the SAME protection rules apply whether the
  // operator opens `/admin/orders` on the main host or `/orders` on the
  // subdomain. The auth flow is excluded so signing in still works.
  const isAuthFlow = pathname.startsWith("/auth") || isGuestOnly(pathname);
  const subdomainRewrites = onAdminHost && !pathname.startsWith("/admin") && !isAuthFlow;
  // The console's HOME is `/admin`. Operators type `/dashboard` (and the main
  // app's post-login intent carries that path), which naively becomes
  // `/admin/dashboard` — a route that does not exist, so the entry point
  // landed on a 404. Resolve it to the real home instead.
  const mappedPath = subdomainRewrites
    ? `/admin${pathname === "/" ? "" : pathname}`
    : pathname;
  const isAdminHomeAlias = mappedPath === "/admin/dashboard";
  const effectivePath = isAdminHomeAlias ? "/admin" : mappedPath;

  // On the MAIN host there is no rewrite step, so the alias must move the
  // browser itself — otherwise `/admin/dashboard` would still be looked up
  // as a page and 404. The subdomain keeps the operator's typed URL and
  // renders the home under it (same as every other subdomain path).
  if (isAdminHomeAlias && !subdomainRewrites) {
    const home = request.nextUrl.clone();
    home.pathname = "/admin";
    return NextResponse.redirect(home);
  }

  // Check for session cookie (set by the auth API / MSW handler)
  // In dev mode with MSW, the auth-store manages session client-side in localStorage.
  // The middleware primarily handles the UX of redirect + intent preservation.
  // MSW-based sessions are read from localStorage, which isn't accessible in middleware.
  //
  // For Phase 4 we use a session cookie approach alongside the Zustand store.
  const sessionCookie = request.cookies.get("legalir-session");

  // --- Protected routes: redirect to login if not authenticated ---
  if (isProtected(effectivePath)) {
    if (!sessionCookie) {
      // The login is served on the SAME host the operator is using, so the
      // session cookie lands on that origin. A host-only cookie set on
      // `localhost` is NEVER sent to `admin.localhost` (and vice-versa), so
      // bouncing a subdomain visitor to the root host would sign them in on
      // the wrong origin and strand them there. `isAuthFlow` above already
      // keeps `/auth` out of the admin rewrite, so the auth page renders
      // normally on the subdomain too, and the preserved `intent` returns
      // the operator to the admin tree on the same host.
      const loginUrl = new URL("/auth/mobile", request.url);
      if (effectivePath !== "/dashboard") {
        // Preserve the query string too — a guest who started from a specific
        // lawyer (`/consultations/new?lawyerId=X`) must return to the same
        // lawyer after signing in, not a bare wizard.
        loginUrl.searchParams.set("intent", effectivePath + request.nextUrl.search);
      }
      return NextResponse.redirect(loginUrl);
    }
    // Authenticated: serve the admin tree for a subdomain request.
    if (subdomainRewrites) {
      const url = request.nextUrl.clone();
      url.pathname = effectivePath;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Any remaining admin-subdomain navigational path (e.g. `/` on
  // admin.localhost, which is "public" on the main host) resolves to the
  // admin tree.
  if (subdomainRewrites) {
    const url = request.nextUrl.clone();
    url.pathname = effectivePath;
    return NextResponse.rewrite(url);
  }

  // --- Guest-only routes: redirect to the session's workspace if signed in ---
  if (isGuestOnly(pathname)) {
    if (sessionCookie) {
      // The login routes write `legalir-home` from the user's role, so a
      // lawyer is never bounced into the consumer dashboard. Only internal
      // paths are honoured — the cookie is httpOnly but still untrusted
      // input for a redirect target.
      const home = request.cookies.get("legalir-home")?.value;
      const target = home && home.startsWith("/") && !home.startsWith("//") ? home : "/dashboard";
      return NextResponse.redirect(new URL(target, request.url));
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
  // Skip the middleware entirely for static assets and API routes. The
  // previous matcher only excluded a handful of extensions, so every
  // font/PDF/icon request still paid for a middleware invocation (and
  // the isPublic/isProtected scans) before being served.
  matcher: [
    "/((?!_next/static|_next/image|api|favicon.ico|mockServiceWorker.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|pdf|txt|xml|json|webmanifest)$).*)",
  ],
};
