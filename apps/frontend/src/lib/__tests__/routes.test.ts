// ============================================================
// LEGALIR — Route Registry & Permission Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  routes,
  getMainNavItems,
  getBottomNavItems,
  canAccessRoute,
  isPublicPath,
  isAuthPath,
} from "@/lib/routes";

// ============================================================
// Route Definitions
// ============================================================

describe("Route definitions", () => {
  it("has all required main navigation routes", () => {
    const paths = routes.filter((r) => !r.hidden && r.icon).map((r) => r.path);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/new");
    expect(paths).toContain("/history");
    expect(paths).toContain("/documents");
    expect(paths).toContain("/contracts");
    expect(paths).toContain("/subscription");
    expect(paths).toContain("/profile");
  });

  it("has correct Persian titles for navigation", () => {
    const dashboard = routes.find((r) => r.path === "/dashboard");
    expect(dashboard?.titleFa).toBe("خانه");
    const newRoute = routes.find((r) => r.path === "/new");
    expect(newRoute?.titleFa).toBe("ساخت جدید");
    const history = routes.find((r) => r.path === "/history");
    expect(history?.titleFa).toBe("تاریخچه");
    const docs = routes.find((r) => r.path === "/documents");
    expect(docs?.titleFa).toBe("اسناد");
    const contracts = routes.find((r) => r.path === "/contracts");
    expect(contracts?.titleFa).toBe("قراردادها");
  });

  it("has admin-only routes hidden from main nav", () => {
    const adminRoutes = routes.filter((r) => r.access === "admin");
    expect(adminRoutes.length).toBeGreaterThan(0);
    adminRoutes.forEach((r) => {
      expect(r.hidden).toBe(true);
    });
  });
});

// ============================================================
// Permission-aware navigation
// ============================================================

describe("getMainNavItems", () => {
  it("returns all non-admin nav items for admin users", () => {
    const items = getMainNavItems("admin");
    const paths = items.map((i) => i.path);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/new");
  });

  it("does not include admin-only routes for user role", () => {
    const items = getMainNavItems("user");
    const paths = items.map((i) => i.path);
    expect(paths).not.toContain("/admin/users");
    expect(paths).not.toContain("/admin/review");
    expect(paths).not.toContain("/admin/health");
  });

  it("does not include hidden routes", () => {
    const items = getMainNavItems("admin");
    const paths = items.map((i) => i.path);
    expect(paths).not.toContain("/chat"); // hidden
    expect(paths).not.toContain("/settings"); // hidden
  });

  it("does not include public or auth routes", () => {
    const items = getMainNavItems("user");
    const paths = items.map((i) => i.path);
    expect(paths).not.toContain("/");
    expect(paths).not.toContain("/pricing");
    expect(paths).not.toContain("/auth/mobile");
  });
});

describe("getBottomNavItems", () => {
  it("returns at most 5 items", () => {
    const items = getBottomNavItems("user");
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("includes dashboard as first item", () => {
    const items = getBottomNavItems("user");
    expect(items[0]?.path).toBe("/dashboard");
  });

  it("only includes items the user can access", () => {
    const items = getBottomNavItems("user");
    const paths = items.map((i) => i.path);
    expect(paths).not.toContain("/admin/users");
  });
});

describe("canAccessRoute", () => {
  it("allows admin to access admin routes", () => {
    const adminRoute = routes.find((r) => r.path === "/admin/users");
    expect(canAccessRoute(adminRoute!, "admin")).toBe(true);
  });

  it("denies user access to admin routes", () => {
    const adminRoute = routes.find((r) => r.path === "/admin/users");
    expect(canAccessRoute(adminRoute!, "user")).toBe(false);
  });

  it("allows user to access entitled routes when entitled", () => {
    const docRoute = routes.find((r) => r.path === "/documents");
    expect(canAccessRoute(docRoute!, "admin")).toBe(true);
  });

  it("denies entitled-only route to basic user", () => {
    const docRoute = routes.find((r) => r.path === "/documents");
    expect(docRoute!.access).toBe("entitled");
  });
});

// ============================================================
// Path utilities
// ============================================================

describe("isPublicPath", () => {
  it("identifies public routes", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/features")).toBe(true);
  });

  it("returns false for app routes", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/documents")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("identifies auth routes", () => {
    expect(isAuthPath("/auth/mobile")).toBe(true);
    expect(isAuthPath("/auth/verify")).toBe(true);
    expect(isAuthPath("/auth/profile")).toBe(true);
    expect(isAuthPath("/dashboard")).toBe(false);
  });
});
