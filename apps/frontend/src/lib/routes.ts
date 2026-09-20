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
  { path: "/subscription", titleFa: "اشتراک", access: "user", icon: "WorkspacePremium" },

  // App — Secondary (not in main nav)
  { path: "/chat", titleFa: "گفت‌وگوی حقوقی", access: "entitled", icon: "Chat", hidden: true },
  { path: "/settings", titleFa: "تنظیمات", access: "user", icon: "Settings", hidden: true },

  // App — Admin only
  { path: "/admin/users", titleFa: "مدیریت کاربران", access: "admin", icon: "Person", hidden: true },
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

/**
 * Returns bottom navigation items (max 5) for mobile.
 * Most important routes for quick access.
 */
export function getBottomNavItems(role: UserRole): RouteDef[] {
  const mainItems = getMainNavItems(role);
  // Priority: dashboard, new, memory, history, documents
  const priorityOrder = ["/dashboard", "/services", "/new", "/support", "/profile"];
  const ordered = priorityOrder
    .map((p) => mainItems.find((r) => r.path === p))
    .filter((r): r is RouteDef => r !== undefined);
  return ordered.slice(0, 5);
}

/**
 * Checks if a user with the given role can access a route.
 */
export function canAccessRoute(route: RouteDef, role: UserRole): boolean {
  const required = ACCESS_LEVEL[route.access];
  const userLevel = role === "admin" ? ACCESS_LEVEL["admin"] : ACCESS_LEVEL["user"];
  return userLevel >= required;
}
