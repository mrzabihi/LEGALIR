// ============================================================
// LEGALIR — Route Registry & Utilities
// ============================================================

export type RouteAccess = "guest" | "challenge" | "authenticated" | "entitled" | "owner" | "admin" | "user";

export interface RouteDef {
  path: string;
  titleFa: string;
  access: RouteAccess;
  icon?: string;
  /** If true, the route is hidden from navigation (rendered via other means) */
  hidden?: boolean;
}

export const routes: RouteDef[] = [
  // Public
  { path: "/", titleFa: "صفحه اصلی", access: "guest", icon: "Home" },
  { path: "/pricing", titleFa: "تعرفه‌ها", access: "guest", icon: "Payment" },
  { path: "/features", titleFa: "قابلیت‌ها", access: "guest", icon: "Star" },
  { path: "/about", titleFa: "درباره LEGALIR", access: "guest", icon: "Info" },
  { path: "/contact", titleFa: "تماس با ما", access: "guest", icon: "Phone" },
  { path: "/terms", titleFa: "قوانین استفاده", access: "guest", icon: "Article" },
  { path: "/privacy-policy", titleFa: "حریم خصوصی", access: "guest", icon: "Shield" },
  { path: "/blog", titleFa: "بلاگ", access: "guest", icon: "Article" },
  { path: "/login", titleFa: "ورود", access: "guest" },
  { path: "/register", titleFa: "ثبت‌نام", access: "guest" },

  // Auth
  { path: "/auth/mobile", titleFa: "ورود", access: "guest" },
  { path: "/auth/verify", titleFa: "تأیید کد", access: "challenge" },
  { path: "/auth/profile", titleFa: "تکمیل اطلاعات", access: "authenticated" },

  // App — Workplace (main navigation)
  { path: "/dashboard", titleFa: "خانه", access: "user", icon: "Home" },
  { path: "/services", titleFa: "خدمات", access: "user", icon: "Services" },
  { path: "/profile", titleFa: "تنظیمات", access: "user", icon: "Person" },
  { path: "/support", titleFa: "پشتیبانی", access: "user", icon: "Phone" },
  { path: "/new", titleFa: "ساخت جدید", access: "user", icon: "Add" },
  { path: "/history", titleFa: "تاریخچه", access: "user", icon: "History" },
  { path: "/documents", titleFa: "اسناد", access: "entitled", icon: "Description" },
  { path: "/contracts", titleFa: "قراردادها", access: "entitled", icon: "Article" },
  { path: "/calculators", titleFa: "محاسبه‌گرها", access: "user", icon: "Calculator" },
  { path: "/lawyers", titleFa: "وکلا", access: "user", icon: "Balance" },
  { path: "/lawyer", titleFa: "میزکار وکیل", access: "user", icon: "Balance", hidden: true },
  { path: "/cases", titleFa: "پرونده‌ها", access: "user", icon: "Balance" },
  { path: "/consultations", titleFa: "مشاوره‌های من", access: "user", icon: "Balance" },
  { path: "/requests", titleFa: "درخواست‌ها", access: "user", icon: "Article", hidden: true },
  { path: "/intake", titleFa: "پرسش‌نامه حقوقی", access: "user", icon: "Category", hidden: true },
  { path: "/subscription", titleFa: "اشتراک", access: "user", icon: "WorkspacePremium" },

  // App — Secondary (not in main nav)
  { path: "/chat", titleFa: "گفت‌وگوی حقوقی", access: "entitled", icon: "Chat", hidden: true },
  { path: "/settings", titleFa: "تنظیمات", access: "user", icon: "Settings", hidden: true },

  // App — Admin only
  { path: "/admin/users", titleFa: "مدیریت کاربران", access: "admin", icon: "Person", hidden: true },
  { path: "/admin/knowledge", titleFa: "پایگاه دانش حقوقی", access: "admin", icon: "Library", hidden: true },
  { path: "/admin/review", titleFa: "بازبینی محتوا", access: "admin", icon: "Shield", hidden: true },
  { path: "/admin/health", titleFa: "سلامت سیستم", access: "admin", icon: "Dashboard", hidden: true },
];

export const publicPaths = routes.filter((r) => r.access === "guest").map((r) => r.path);
export const authPaths = ["/auth/mobile", "/auth/verify", "/auth/profile"];
export const appPaths = routes.filter((r) => !authPaths.includes(r.path) && r.path !== "/").map((r) => r.path);

export function isPublicPath(path: string): boolean {
  return publicPaths.includes(path);
}

export function isAuthPath(path: string): boolean {
  return authPaths.includes(path);
}

export function getRouteByPath(path: string): RouteDef | undefined {
  return routes.find((r) => r.path === path);
}

// ============================================================
// Permission-aware navigation filtering
// ============================================================

/** User role for permission checks */
export type UserRole = "user" | "admin";

/** Access level hierarchy: higher values include lower levels */
const ACCESS_LEVEL: Record<RouteAccess, number> = {
  guest: 0,
  challenge: 1,
  authenticated: 2,
  user: 3,
  entitled: 4,
  owner: 5,
  admin: 6,
};

/**
 * Returns main navigation items visible to the given role.
 * - Excludes hidden routes
 * - Excludes admin-only routes from non-admin users
 * - Excludes public/auth routes
 */
export function getMainNavItems(role: UserRole): RouteDef[] {
  const minLevel = ACCESS_LEVEL["user"];
  const maxLevel = role === "admin" ? ACCESS_LEVEL["admin"] : ACCESS_LEVEL["owner"];

  return routes.filter((r) => {
    if (r.hidden) return false;
    if (!r.icon) return false;
    const level = ACCESS_LEVEL[r.access];
    return level >= minLevel && level <= maxLevel;
  });
}

// ============================================================
// Bottom navigation — Persian capsule bar (v0.6)
// ============================================================
// The mobile bar is a fixed, hand-ordered set of four destinations plus a
// centre action. It is deliberately *not* derived from `getMainNavItems`:
// the visual order (خانه · خدمات · [ساخت جدید] · پشتیبانی · تنظیمات) is a
// product decision, and the centre slot is a verb (opens a sheet), not a
// route. Keeping the list here — next to the active-match rule — means the
// bar and its tests read from one source of truth.

export interface BottomNavDestination {
  path: string;
  titleFa: string;
  /** Key into the bottom-nav icon map (see components/app/bottom-nav.tsx). */
  icon: string;
}

/** Right-to-left visual order. The centre slot is rendered separately. */
export const bottomNavDestinations: BottomNavDestination[] = [
  { path: "/dashboard", titleFa: "خانه", icon: "Home" },
  { path: "/services", titleFa: "خدمات", icon: "Grid" },
  { path: "/support", titleFa: "پشتیبانی", icon: "Headset" },
  { path: "/profile", titleFa: "تنظیمات", icon: "Settings" },
];

export interface CreateAction {
  id: string;
  titleFa: string;
  /** Real in-app destination the action opens. */
  href: string;
  /** Key into the create-action icon map. */
  icon: string;
}

/**
 * The four quick-start actions in the «ساخت جدید» sheet. Each points at an
 * existing flow — opening the sheet never creates a contract, request or AI
 * run by itself; the user must pick an action.
 */
export const createActions: CreateAction[] = [
  { id: "draft-contract", titleFa: "تنظیم قرارداد", href: "/contracts/new", icon: "FilePen" },
  { id: "review-contract", titleFa: "بررسی قرارداد", href: "/contracts/review", icon: "FileSearch" },
  { id: "generate-notice", titleFa: "تولید اظهارنامه", href: "/chat?category=formal_letter", icon: "FileText" },
  { id: "legal-consultation", titleFa: "مشاوره حقوقی", href: "/chat", icon: "Chat" },
];

/**
 * The destination that should be lit for `pathname`, or `null` when the
 * current page is outside the four destinations (e.g. `/contracts`). Uses
 * the same segment-boundary rule as `isNavItemActive`, so `/services-archive`
 * never lights «خدمات» and `/dashboard` never lights for every path.
 */
export function getActiveBottomNavPath(pathname: string): string | null {
  const match = bottomNavDestinations.find((d) => isNavItemActive(pathname, d.path));
  return match ? match.path : null;
}

/**
 * Whether a navigation item should render as selected for `pathname`.
 *
 * An item owns its own path *and* every nested route beneath it, so
 * `/services`, `/services/xyz` and `/services/xyz/edit` all keep «خدمات»
 * lit. The centre action (`/new`) is exact-match only — it is a verb, not a
 * section, so it must never stay lit while the user is elsewhere. No two
 * items can match at once because no nav path is a prefix of another.
 */
export function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true;
  if (itemPath === "/new") return false;
  return pathname.startsWith(itemPath + "/");
}

/**
 * Checks if a user with the given role can access a route.
 */
export function canAccessRoute(route: RouteDef, role: UserRole): boolean {
  const required = ACCESS_LEVEL[route.access];
  const userLevel = role === "admin" ? ACCESS_LEVEL["admin"] : ACCESS_LEVEL["user"];
  return userLevel >= required;
}
