// ============================================================
// LEGALIR — Mobile Bottom Navigation
// Modern circular center FAB design
// Items: Home, Services, New (center FAB), Profile
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBottomNavItems } from "@/lib/routes";
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
};

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomNavItems(userRole);

  return (
    <nav
      className="flex items-center justify-around h-[72px] px-1 safe-bottom bg-surface border-t border-divider relative"
      role="navigation"
      aria-label="منوی پایین"
    >
      {items.map((item) => {
        const isActive = pathname === item.path
          || (item.path !== "/dashboard" && item.path !== "/services"
            && item.path !== "/profile" && pathname.startsWith(item.path + "/"));
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
                "bg-primary-700 text-white",
                "shadow-elevation-8 hover:shadow-elevation-16",
                "active:scale-95 transition-all duration-200",
                "touch-target",
              ].join(" ")}
              aria-label={item.titleFa}
              aria-current={isActive ? "page" : undefined}
            >
              {IconComp ? <IconComp size={26} /> : <span className="text-xl">+</span>}
            </Link>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            className={[
              "relative flex flex-col items-center justify-center gap-1 z-10",
              "min-w-[72px] h-full px-1",
              "transition-all duration-200",
              "tap-highlight-transparent touch-target-min",
              "active:scale-95",
              isActive
                ? "text-primary-700"
                : "text-muted hover:text-on-surface",
            ].join(" ")}
            aria-label={item.titleFa}
            aria-current={isActive ? "page" : undefined}
          >
            <div
              className={[
                "absolute top-1 left-1/2 -translate-x-1/2",
                "h-1 rounded-full transition-all duration-300",
                isActive ? "w-6 bg-primary-600" : "w-0 bg-transparent",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className="relative">
              {IconComp ? <IconComp size={22} /> : <span className="text-lg">•</span>}
            </span>
            <span className={[
              "text-labelSmall font-medium",
              isActive ? "text-primary-700" : "text-muted",
            ].join(" ")}>
              {item.titleFa}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
