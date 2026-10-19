// ============================================================
// LEGALIR — Lawyer panel navigation registry
// ============================================================
// The single source of truth for the lawyer workbench menu. The shell renders
// from it; each entry names the `Permission` that gates it. That permission is
// a UX affordance only — every `/api/v1/lawyer/**` route re-checks it
// server-side (lib/lawyer-portal/http.ts → lib/rbac.ts).
// ============================================================

import type { Permission } from "@legalir/types";

export interface LawyerNavItem {
  key: string;
  /** Route under `/lawyer`. */
  path: string;
  titleFa: string;
  hintFa: string;
  /** Key into the lawyer icon map (components/lawyer/lawyer-shell.tsx). */
  icon: string;
  permission: Permission;
}

export const LAWYER_NAV: LawyerNavItem[] = [
  {
    key: "overview",
    path: "/lawyer",
    titleFa: "نمای کلی",
    hintFa: "وضعیت درخواست‌ها و کارهای فوری",
    icon: "Dashboard",
    permission: "lawyer:request:read:assigned",
  },
  {
    key: "referrals",
    path: "/lawyer/referrals",
    titleFa: "درخواست‌ها",
    hintFa: "صف ارجاع‌ها و مهلت‌ها",
    icon: "Balance",
    permission: "lawyer:request:read:assigned",
  },
  {
    key: "profile",
    path: "/lawyer/profile",
    titleFa: "پروفایل حرفه‌ای",
    hintFa: "اطلاعات، تخصص و محدودهٔ خدمات",
    icon: "Person",
    permission: "lawyer:profile:write",
  },
  {
    key: "rates",
    path: "/lawyer/rates",
    titleFa: "نرخ خدمات",
    hintFa: "قیمت هر خدمت و روش محاسبه",
    icon: "Calculator",
    permission: "lawyer:rates:manage",
  },
  {
    key: "bank",
    path: "/lawyer/bank",
    titleFa: "حساب تسویه",
    hintFa: "شماره شبا و وضعیت بررسی",
    icon: "Balance",
    permission: "lawyer:bank:manage",
  },
];

/** The active item for a pathname (longest matching prefix wins). */
export function activeLawyerNavKey(pathname: string | null): string | null {
  if (!pathname) return null;
  let best: LawyerNavItem | null = null;
  for (const item of LAWYER_NAV) {
    const matches = pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (!matches) continue;
    if (!best || item.path.length > best.path.length) best = item;
  }
  return best?.key ?? null;
}

/** The section title shown in the shell header. */
export function lawyerSectionTitle(pathname: string | null): string {
  const key = activeLawyerNavKey(pathname);
  if (!key) return "پنل وکیل";
  return LAWYER_NAV.find((i) => i.key === key)?.titleFa ?? "پنل وکیل";
}
