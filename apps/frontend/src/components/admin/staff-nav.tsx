// ============================================================
// LEGALIR — Admin · Staff section sub-navigation
// ============================================================
// The three faces of the "مدیران، نقش‌ها و رویدادهای امنیتی" section:
//   • کارکنان    /admin/staff               (staff list + security events)
//   • نقش‌ها      /admin/staff/roles         (role → permission matrix)
//   • مجوزها     /admin/staff/permissions   (the permission catalog)
// A light underline tab row, consistent with the admin design system. It is a
// pure client affordance — every target route re-checks `admin:staff:read`.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/staff", label: "کارکنان", exact: true },
  { href: "/admin/staff/roles", label: "نقش‌ها", exact: false },
  { href: "/admin/staff/permissions", label: "مجوزها", exact: false },
] as const;

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="بخش‌های مدیریت کارکنان"
      className="mb-5 flex gap-1 overflow-x-auto border-b border-divider"
    >
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center whitespace-nowrap border-b-2 px-3.5 py-2.5 text-body-2 font-medium transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:border-outline-variant hover:text-on-surface"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
