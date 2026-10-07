// ============================================================
// LEGALIR — Admin panel navigation registry
// ============================================================
// The eighteen sections of the platform admin panel, in display order.
// This is the SINGLE source of truth for the admin menu: the shell renders
// from it and each entry names the `Permission` that gates it. The
// permission is a UX affordance only — every admin API re-checks the same
// permission server-side (see lib/rbac.ts + the admin dispatcher route).
//
// `path` values map 1:1 to a page under app/(app)/admin/**.
// ============================================================

import type { Permission } from "@legalir/types";

export interface AdminNavItem {
  /** Stable key (used as the React key and for tests). */
  key: string;
  /** Route under `/admin`. */
  path: string;
  titleFa: string;
  /** Short one-line purpose shown under the title in the sidebar. */
  hintFa: string;
  /** Key into the admin icon map (components/admin/admin-shell.tsx). */
  icon: string;
  /** The permission required to SEE this section (server re-checks it). */
  permission: Permission;
}

/** The eighteen admin sections, in product order. */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    key: "overview",
    path: "/admin",
    titleFa: "نمای کلی",
    hintFa: "شاخص‌های کلیدی پلتفرم",
    icon: "Dashboard",
    permission: "admin:overview:read",
  },
  {
    key: "users",
    path: "/admin/users",
    titleFa: "کاربران و سازمان‌ها",
    hintFa: "کاربران، نقش‌ها و سازمان‌ها",
    icon: "Users",
    permission: "admin:users:read",
  },
  {
    key: "requests",
    path: "/admin/requests",
    titleFa: "درخواست‌ها و پرونده‌ها",
    hintFa: "درخواست‌های حقوقی و گردش وضعیت",
    icon: "Balance",
    permission: "admin:requests:read",
  },
  {
    key: "lawyers",
    path: "/admin/lawyers",
    titleFa: "وکلا",
    hintFa: "صف تأیید و پروفایل وکلا",
    icon: "LawBook",
    // The lawyer queue API (GET + POST verification) requires `verify`, so the
    // link must be gated by the same permission — a `read`-only role would
    // otherwise open a section that 403s.
    permission: "admin:lawyer:verify",
  },
  {
    key: "services",
    path: "/admin/services",
    titleFa: "خدمات و پرچم‌های ویژگی",
    hintFa: "خدمات فعال و کنترل انتشار",
    icon: "Services",
    permission: "admin:services:read",
  },
  {
    key: "energy",
    path: "/admin/energy",
    titleFa: "انرژی و هزینهٔ خدمات",
    hintFa: "مدل هزینه، قواعد و دفتر مصرف",
    icon: "Bolt",
    permission: "admin:energy:read",
  },
  {
    key: "plans",
    path: "/admin/plans",
    titleFa: "پلن‌ها، اشتراک و سهمیه",
    hintFa: "کاتالوگ پلن و سهمیه‌ها",
    icon: "Subscription",
    permission: "admin:plans:read",
  },
  {
    key: "orders",
    path: "/admin/orders",
    titleFa: "فروش، پرداخت و بازگشت",
    hintFa: "سفارش‌ها و تعدیل‌های مالی",
    icon: "Coin",
    permission: "admin:billing:read",
  },
  {
    key: "finance",
    path: "/admin/finance",
    titleFa: "مالی و تسویه وکلا",
    hintFa: "کمیسیون و تسویه‌حساب",
    icon: "Balance",
    permission: "admin:finance:read",
  },
  {
    key: "ai",
    path: "/admin/ai",
    titleFa: "هوش مصنوعی و مدل‌ها",
    hintFa: "ارائه‌دهنده‌ها، پرامپت و مصرف",
    icon: "Bolt",
    permission: "admin:ai:read",
  },
  {
    key: "rag",
    path: "/admin/rag",
    titleFa: "منابع حقوقی و RAG",
    hintFa: "بازبینی و انتشار منابع",
    icon: "Database",
    permission: "admin:rag:read",
  },
  {
    key: "calculators",
    path: "/admin/calculators",
    titleFa: "محاسبه‌گرها و داده حقوقی",
    hintFa: "مجموعه‌داده‌های نرخ و به‌روزرسانی سالانه",
    icon: "Calculator",
    permission: "admin:calculators:read",
  },
  {
    key: "support",
    path: "/admin/support",
    titleFa: "پشتیبانی و گزارش مشکلات",
    hintFa: "تیکت‌ها و رعایت SLA",
    icon: "Headset",
    permission: "admin:support:read",
  },
  {
    key: "content",
    path: "/admin/content",
    titleFa: "محتوا و اطلاع‌رسانی",
    hintFa: "وبلاگ و اعلان‌ها",
    icon: "Document",
    permission: "admin:content:read",
  },
  {
    key: "analytics",
    path: "/admin/analytics",
    titleFa: "تحلیل و هوش تجاری",
    hintFa: "فروش، انرژی، مشتریان و مالی",
    icon: "Grid",
    permission: "admin:analytics:read",
  },
  {
    key: "reports",
    path: "/admin/reports",
    titleFa: "گزارش‌ها و خروجی",
    hintFa: "تحلیل فروش و خروجی داده",
    icon: "Download",
    permission: "admin:reports:read",
  },
  {
    key: "staff",
    path: "/admin/staff",
    titleFa: "مدیران، نقش‌ها و رویدادهای امنیتی",
    hintFa: "کارکنان، ماتریس دسترسی و رویدادها",
    icon: "Shield",
    permission: "admin:staff:read",
  },
  {
    key: "settings",
    path: "/admin/settings",
    titleFa: "تنظیمات سازمان و اتصال‌ها",
    hintFa: "محیط، یکپارچه‌سازی‌ها و وضعیت واقعی",
    icon: "Settings",
    permission: "admin:settings:read",
  },
];

/** The nav item whose `path` owns `pathname` (longest-prefix match). */
export function activeAdminNavKey(pathname: string): string | null {
  // Match the most specific path first: the longest path the pathname starts
  // with, so nested pages (/admin/staff/roles) resolve to their section
  // (/admin/staff). The overview is a LEAF at exactly "/admin" — it must not
  // act as a prefix parent, or every unmapped admin route (/admin/profile,
  // /admin/health …) would misleadingly report the overview section.
  const sorted = [...ADMIN_NAV].sort((a, b) => b.path.length - a.path.length);
  const match = sorted.find((item) =>
    item.path === "/admin"
      ? pathname === "/admin"
      : pathname === item.path || pathname.startsWith(item.path + "/")
  );
  return match ? match.key : null;
}

/** The nav item for a section key, if any. */
export function adminNavByKey(key: string): AdminNavItem | undefined {
  return ADMIN_NAV.find((i) => i.key === key);
}

// Admin surfaces that exist as real routes but are intentionally unlinked from
// the sidebar (deep-link / operational pages). They are NOT in ADMIN_NAV, so
// `activeAdminNavKey` correctly returns null for them; without this list the
// shell header and breadcrumb would fall back to a generic label. Each entry
// mirrors the page's own `PageHeader` title so the chrome agrees with the page.
const HIDDEN_ADMIN_TITLES: { path: string; titleFa: string }[] = [
  { path: "/admin/knowledge", titleFa: "پایگاه دانش حقوقی" },
  { path: "/admin/health", titleFa: "وضعیت سامانه" },
  { path: "/admin/profile", titleFa: "پروفایل من" },
];

/**
 * The section title for `pathname` — the nav item that owns the route, or, for
 * a hidden admin surface, its real page title. Falls back to "مدیریت" only for
 * genuinely unmapped paths. Use this for the shell header + breadcrumb so a
 * hidden route never mislabels itself as «نمای کلی».
 */
export function adminSectionTitle(pathname: string): string {
  const key = activeAdminNavKey(pathname);
  const navItem = key ? adminNavByKey(key) : undefined;
  if (navItem) return navItem.titleFa;

  const hidden = [...HIDDEN_ADMIN_TITLES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((h) => pathname === h.path || pathname.startsWith(h.path + "/"));
  return hidden?.titleFa ?? "مدیریت";
}
