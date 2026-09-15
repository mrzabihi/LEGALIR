// ============================================================
// LEGALIR — Mobile Bottom Navigation
// Floating glass-pill bar with an elevated center action button,
// animated active indicator, and safe-area support.
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
      className="pointer-events-auto fixed bottom-3 inset-x-3 z-40 flex items-center justify-around h-[64px] px-2 rounded-3xl bg-surface/80 backdrop-blur-xl border border-white/20 shadow-elevation-8 safe-bottom"
      role="navigation"
      aria-label="منوی پایین"
    >
      {items.map((item) => {
        const isActive = pathname === item.path
          || (item.path !== "/dashboard" && item.path !== "/services"
            && item.path !== "/support" && item.path !== "/profile"
            && pathname.startsWith(item.path + "/"));
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
                ? "text-primary-700"
                : "text-neutral-400 hover:text-neutral-600",
            ].join(" ")}
            aria-label={item.titleFa}
            aria-current={isActive ? "page" : undefined}
          >
            {/* Animated active pill indicator */}
            <span
              className={[
                "absolute top-1 left-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ease-emphasized",
                isActive ? "w-8 h-6 bg-primary-100/80" : "w-0 h-6 bg-transparent",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className={["relative transition-transform duration-200", isActive ? "scale-110 -translate-y-0.5" : "scale-100"].join(" ")}>
              {IconComp ? <IconComp size={22} /> : <span className="text-lg">•</span>}
            </span>
            <span className={[
              "relative text-[11px] font-medium leading-none transition-colors duration-200",
              isActive ? "text-primary-700" : "text-neutral-400",
            ].join(" ")}>
              {item.titleFa}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
