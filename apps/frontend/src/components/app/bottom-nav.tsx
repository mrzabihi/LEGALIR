// ============================================================
// LEGALIR — Mobile Bottom Navigation
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBottomNavItems } from "@/lib/routes";
import type { UserRole } from "@/lib/routes";
import {
  IconDashboard,
  IconAdd,
  IconMemory,
  IconHistory,
  IconDocument,
} from "@/lib/icons";

interface BottomNavProps {
  userRole: UserRole;
}

const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Dashboard: IconDashboard,
  Add: IconAdd,
  Memory: IconMemory,
  History: IconHistory,
  Description: IconDocument,
};

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomNavItems(userRole);

  return (
    <div className="flex items-center justify-around h-16 safe-bottom" role="navigation" aria-label="منوی پایین">
      {items.map((item) => {
        const isActive = pathname === item.path;
        const IconComp = item.icon ? NAV_ICON_MAP[item.icon] : null;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={[
              "flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] h-full px-2",
              "transition-colors tap-highlight-transparent touch-target-min",
              "active:scale-95",
              isActive ? "text-primary-700" : "text-neutral-400 hover:text-neutral-600",
            ].join(" ")}
            aria-label={item.titleFa}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative">
              {IconComp ? <IconComp size={22} /> : <span className="text-lg">•</span>}
            </span>
            <span className="text-labelSmall">{item.titleFa}</span>
          </Link>
        );
      })}
    </div>
  );
}
