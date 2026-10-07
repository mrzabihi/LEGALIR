// ============================================================
// LEGALIR — Middleware routing & guard tests
// ============================================================
// The middleware is the only place that decides, for an unauthenticated
// visitor, where they are sent — and the only place that rewrites the admin
// subdomain onto the `/admin` tree. These tests pin that behaviour so a future
// edit cannot silently break the subdomain entry point or leak a protected
// route through.
// ============================================================

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const SESSION = "valid-session-id";

function makeReq(url: string, opts: { host?: string; session?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.host) headers.set("host", opts.host);
  if (opts.session) headers.set("cookie", `legalir-session=${opts.session}`);
  return new NextRequest(new URL(url), { headers });
}

const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";
const rewriteTarget = (res: Response) => res.headers.get("x-middleware-rewrite");
const locationOf = (res: Response) => new URL(res.headers.get("location")!);

describe("middleware — protected routes", () => {
  it("redirects an unauthenticated visitor to login with the intent preserved", () => {
    const res = middleware(makeReq("http://localhost:3000/admin/orders"));
    expect(res.status).toBe(307);
    const loc = locationOf(res);
    expect(loc.pathname).toBe("/auth/mobile");
    expect(loc.searchParams.get("intent")).toBe("/admin/orders");
  });

  it("does not echo an intent for the bare dashboard", () => {
    const res = middleware(makeReq("http://localhost:3000/dashboard"));
    expect(res.status).toBe(307);
    expect(locationOf(res).searchParams.get("intent")).toBeNull();
  });

  it("passes an authenticated visitor through", () => {
    const res = middleware(makeReq("http://localhost:3000/admin/orders", { session: SESSION }));
    expect(isNext(res)).toBe(true);
    expect(res.status).not.toBe(307);
  });

  it("leaves static assets and API routes untouched", () => {
    expect(isNext(middleware(makeReq("http://localhost:3000/_next/static/x.js")))).toBe(true);
    expect(isNext(middleware(makeReq("http://localhost:3000/api/v1/admin/overview")))).toBe(true);
  });
});

describe("middleware — guest-only routes", () => {
  it("keeps a guest on the login page", () => {
    expect(isNext(middleware(makeReq("http://localhost:3000/auth/mobile")))).toBe(true);
  });

  it("bounces an authenticated visitor away from login", () => {
    const res = middleware(makeReq("http://localhost:3000/auth/mobile", { session: SESSION }));
    expect(res.status).toBe(307);
    expect(locationOf(res).pathname).toBe("/dashboard");
  });
});

describe("middleware — admin subdomain", () => {
  it("rewrites a bare subdomain path onto the /admin tree", () => {
    const res = middleware(
      makeReq("http://admin.localhost:3000/orders", { host: "admin.localhost:3000", session: SESSION })
    );
    expect(rewriteTarget(res)).toContain("/admin/orders");
  });

  it("rewrites the subdomain root onto /admin", () => {
    const res = middleware(
      makeReq("http://admin.localhost:3000/", { host: "admin.localhost:3000", session: SESSION })
    );
    expect(rewriteTarget(res)).toContain("/admin");
  });

  it("guards the subdomain too, logging in on the SAME host", () => {
    // A host-only cookie set on `localhost` is never sent to `admin.localhost`,
    // so the login must happen on the subdomain origin itself — not bounced to
    // the root host, which would sign the operator in on the wrong origin.
    const res = middleware(
      makeReq("http://admin.localhost:3000/orders", { host: "admin.localhost:3000" })
    );
    expect(res.status).toBe(307);
    const loc = locationOf(res);
    expect(loc.host).toBe("admin.localhost:3000");
    expect(loc.pathname).toBe("/auth/mobile");
    expect(loc.searchParams.get("intent")).toBe("/admin/orders");
  });

  it("does not rewrite the auth flow on the subdomain", () => {
    expect(isNext(middleware(makeReq("http://admin.localhost:3000/auth/mobile", { host: "admin.localhost:3000" })))).toBe(true);
  });
});
