// ============================================================
// LEGALIR — Mobile Bottom Navigation
// Floating glass-pill bar with an elevated center action button,
// animated active indicator, and safe-area support.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBottomNavItems, isNavItemActive } from "@/lib/routes";
import type { UserRole } from "@/lib/routes";
import {
  IconHome,
  IconServices,
  IconAdd,
  IconPerson,
  IconDashboard,
  IconMemory,
  IconHistory,
  IconDocument,
  IconPhone,
} from "@/lib/icons";

interface BottomNavProps {
  userRole: UserRole;
}

const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Home: IconHome,
  Dashboard: IconDashboard,
  Services: IconServices,
  Add: IconAdd,
  Person: IconPerson,
  Memory: IconMemory,
  History: IconHistory,
  Description: IconDocument,
  Phone: IconPhone,
};

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomNavItems(userRole);

  return (
    <nav
      className="pointer-events-auto fixed bottom-3 inset-x-3 z-40 flex items-center justify-around h-[64px] px-2 rounded-3xl bg-glass-surface backdrop-blur-xl border border-glass-border [box-shadow:var(--bottom-nav-shadow)] safe-bottom"
      role="navigation"
      aria-label="منوی پایین"
    >
      {items.map((item) => {
        // Selected state comes from the shared route helper so the rule is
        // identical everywhere it is needed and unit-testable.
        const isActive = isNavItemActive(pathname, item.path);
        const IconComp = item.icon ? NAV_ICON_MAP[item.icon] : null;
        const isCenter = item.path === "/new";

        if (isCenter) {
          return (
            <Link
              key={item.path}
              href={item.path}
              className={[
                "relative flex items-center justify-center",
                "-mt-8 z-10",
                "w-14 h-14 rounded-full",
                "bg-gradient-to-br from-primary-500 to-primary-700 text-white",
                // Warm ivory hairline keeps the navy FAB legible against the
                // darker smoked-glass surface without changing its identity.
                "ring-2 ring-[rgba(255,249,240,0.45)]",
                "shadow-elevation-8 hover:shadow-elevation-8",
                "active:scale-90 transition-all duration-200 ease-emphasized",
                "touch-target",
              ].join(" ")}
              aria-label={item.titleFa}
              aria-current={isActive ? "page" : undefined}
            >
              {IconComp ? <IconComp size={24} /> : <span className="text-2xl font-light">+</span>}
              <span className="absolute inset-0 rounded-full bg-primary-500/40 blur-md -z-10 animate-glow-pulse" aria-hidden="true" />
            </Link>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            className={[
              "relative flex flex-col items-center justify-center gap-1 z-10",
              "min-w-[56px] h-full px-1",
              "transition-all duration-200 ease-standard",
              "tap-highlight-transparent touch-target-min",
              "active:scale-95",
              isActive
                ? "text-glass-ivory"
                : "text-glass-ivory-muted hover:text-glass-ivory",
            ].join(" ")}
            aria-label={item.titleFa}
            aria-current={isActive ? "page" : undefined}
          >
            {/* Active indicator — a capsule centred on the icon itself.
                It is a sibling of the icon inside a fixed-size box, so it
                can never drift to the item's top edge or leave the gap the
                old `top-1` rectangle produced. */}
            <span className="relative flex h-7 w-14 items-center justify-center">
              <span
                className={[
                  "absolute inset-0 rounded-full transition-opacity duration-200 ease-standard",
                  isActive ? "bg-glass-state opacity-100" : "opacity-0",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="relative">
                {IconComp ? <IconComp size={22} /> : <span className="text-lg">•</span>}
              </span>
            </span>
            <span className={[
              "relative text-[11px] font-medium leading-none transition-colors duration-200",
              isActive ? "text-glass-ivory" : "text-glass-ivory-muted",
            ].join(" ")}>
              {item.titleFa}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
