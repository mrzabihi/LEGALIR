// ============================================================
// LEGALIR — Admin nav registry resolution
// ============================================================
// `activeAdminNavKey` drives three chrome affordances that share one source
// of truth: the sidebar's active item, the header banner title, and the
// page breadcrumb. A wrong mapping is a visible lie ("نمای کلی" shown while
// the operator is on /admin/profile), so the resolution rules are pinned here.
// ============================================================

import { describe, it, expect } from "vitest";
import { activeAdminNavKey, adminNavByKey, adminSectionTitle, ADMIN_NAV } from "@/lib/admin-nav";

describe("activeAdminNavKey", () => {
  it("maps the overview only at exactly /admin", () => {
    expect(activeAdminNavKey("/admin")).toBe("overview");
  });

  it("does NOT treat the overview as a prefix parent of unmapped routes", () => {
    // Regression: /admin/profile, /admin/health and /admin/knowledge are leaf
    // pages with no nav entry; they must not report "نمای کلی".
    expect(activeAdminNavKey("/admin/profile")).toBeNull();
    expect(activeAdminNavKey("/admin/health")).toBeNull();
    expect(activeAdminNavKey("/admin/knowledge")).toBeNull();
  });

  it("maps a section and its nested pages to the same key", () => {
    expect(activeAdminNavKey("/admin/staff")).toBe("staff");
    expect(activeAdminNavKey("/admin/staff/roles")).toBe("staff");
    expect(activeAdminNavKey("/admin/staff/permissions")).toBe("staff");
  });

  it("maps every registered section at its own path", () => {
    for (const item of ADMIN_NAV) {
      expect(activeAdminNavKey(item.path), item.path).toBe(item.key);
    }
  });

  it("exposes the staff section for the header title lookup", () => {
    // The banner title reads adminNavByKey(activeKey)?.titleFa ?? "مدیریت".
    expect(adminNavByKey("staff")?.titleFa).toContain("مدیران");
    expect(activeAdminNavKey("/admin/profile")).toBeNull();
  });
});

describe("adminSectionTitle", () => {
  it("returns the owning nav item's title for mapped routes", () => {
    expect(adminSectionTitle("/admin")).toBe("نمای کلی");
    expect(adminSectionTitle("/admin/staff")).toContain("مدیران");
    // Nested pages resolve to their section title.
    expect(adminSectionTitle("/admin/staff/roles")).toContain("مدیران");
  });

  it("returns the real page title for hidden, unlinked admin routes", () => {
    // Regression: these are leaf routes absent from ADMIN_NAV; the header and
    // breadcrumb must NOT fall back to «نمای کلی» or a generic «مدیریت».
    expect(adminSectionTitle("/admin/knowledge")).toBe("پایگاه دانش حقوقی");
    expect(adminSectionTitle("/admin/health")).toBe("وضعیت سامانه");
    expect(adminSectionTitle("/admin/profile")).toBe("پروفایل من");
  });

  it("falls back to «مدیریت» only for genuinely unmapped paths", () => {
    expect(adminSectionTitle("/admin/does-not-exist")).toBe("مدیریت");
  });
});
