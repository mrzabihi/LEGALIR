// ============================================================
// LEGALIR — Route Registry & Permission Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  routes,
  getMainNavItems,
  bottomNavDestinations,
  getActiveBottomNavPath,
  createActions,
  canAccessRoute,
  isNavItemActive,
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

describe("bottomNavDestinations", () => {
  it("declares the four fixed destinations in visual order", () => {
    expect(bottomNavDestinations.map((d) => d.path)).toEqual([
      "/dashboard",
      "/services",
      "/support",
      "/profile",
    ]);
  });

  it("gives every destination a Persian title and an icon key", () => {
    for (const d of bottomNavDestinations) {
      expect(d.titleFa.length).toBeGreaterThan(0);
      expect(d.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("getActiveBottomNavPath", () => {
  it("lights the destination that owns the current path", () => {
    expect(getActiveBottomNavPath("/dashboard")).toBe("/dashboard");
    expect(getActiveBottomNavPath("/services")).toBe("/services");
    expect(getActiveBottomNavPath("/profile/points")).toBe("/profile");
  });

  it("returns null outside the four destinations", () => {
    expect(getActiveBottomNavPath("/contracts")).toBeNull();
    expect(getActiveBottomNavPath("/services-archive")).toBeNull();
  });

  it("never lights two destinations at once", () => {
    const paths = [
      "/dashboard",
      "/services",
      "/services/contracts/new",
      "/support",
      "/profile/points",
      "/contracts",
    ];
    for (const pathname of paths) {
      const active = bottomNavDestinations.filter((d) =>
        isNavItemActive(pathname, d.path)
      );
      expect(active.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("createActions", () => {
  it("offers four quick-start actions", () => {
    expect(createActions).toHaveLength(4);
  });

  it("points every action at a real in-app destination", () => {
    for (const action of createActions) {
      expect(action.href).toMatch(/^\//);
      expect(action.titleFa.length).toBeGreaterThan(0);
      expect(action.icon.length).toBeGreaterThan(0);
    }
  });

  it("uses unique ids", () => {
    const ids = createActions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isNavItemActive", () => {
  it("matches an item's own path exactly", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/services", "/services")).toBe(true);
    expect(isNavItemActive("/profile", "/profile")).toBe(true);
  });

  it("keeps a section lit on its child routes", () => {
    expect(isNavItemActive("/services/contracts", "/services")).toBe(true);
    expect(isNavItemActive("/services/contracts/new", "/services")).toBe(true);
    expect(isNavItemActive("/profile/points", "/profile")).toBe(true);
  });

  it("does not light a section for a sibling path", () => {
    expect(isNavItemActive("/services-archive", "/services")).toBe(false);
    expect(isNavItemActive("/dashboard", "/services")).toBe(false);
  });

  it("treats the centre action as exact-match only", () => {
    expect(isNavItemActive("/new", "/new")).toBe(true);
    expect(isNavItemActive("/new/contract", "/new")).toBe(false);
  });

  it("never lights two bottom-nav items at once", () => {
    const paths = [
      "/dashboard",
      "/services",
      "/services/contracts/new",
      "/support",
      "/profile/points",
      "/new",
      "/new/contract",
    ];
    for (const pathname of paths) {
      const active = bottomNavDestinations.filter((d) =>
        isNavItemActive(pathname, d.path)
      );
      expect(active.length).toBeLessThanOrEqual(1);
    }
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
