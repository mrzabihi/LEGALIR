// ============================================================
// LEGALIR — Desktop Sidebar Navigation
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMainNavItems } from "@/lib/routes";
import type { UserRole } from "@/lib/routes";
import { useAppShellStore } from "@/lib/stores";
import {
  IconDashboard,
  IconAdd,
  IconMemory,
  IconHistory,
  IconDocument,
  IconContract,
  IconSubscription,
  IconPerson,
} from "@/lib/icons";

interface SidebarProps {
  userRole: UserRole;
}

const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Dashboard: IconDashboard,
  Add: IconAdd,
  Memory: IconMemory,
  History: IconHistory,
  Description: IconDocument,
  Article: IconContract,
  WorkspacePremium: IconSubscription,
  Person: IconPerson,
};

function NavIcon({ icon }: { icon?: string }) {
  const Component = icon ? NAV_ICON_MAP[icon] : null;
  if (!Component) return <span className="w-6 h-6 flex items-center justify-center text-muted">•</span>;
  return <Component size={20} />;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getMainNavItems(userRole);
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);

  return (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-divider">
        <div className="h-9 w-9 rounded-small bg-primary flex items-center justify-center text-white font-bold text-labelMedium shrink-0">
          ل
        </div>
        <span className="text-titleMedium text-primary font-bold">LEGALIR</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "flex items-center gap-3 px-3 py-3 rounded-medium text-labelLarge transition-colors",
                "touch-target select-none",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-onSurfaceVariant hover:bg-onSurface/[0.05] hover:text-onSurface",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={isActive ? "text-primary" : "text-onSurfaceVariant"}>
                <NavIcon icon={item.icon} />
              </span>
              <span>{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer area — subscription link highlighted */}
      <div className="px-3 py-3 border-t border-divider">
        <Link
          href="/subscription"
          className="flex items-center gap-3 px-3 py-3 rounded-medium text-labelLarge text-onSurfaceVariant hover:bg-onSurface/[0.05] transition-colors touch-target"
        >
          <NavIcon icon="WorkspacePremium" />
          <span>اشتراک</span>
        </Link>
      </div>
    </div>
  );
}

/** Mobile drawer version — same links but full-width in the drawer */
export function SidebarMobile({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getMainNavItems(userRole);
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);

  return (
    <nav className="flex flex-col py-3 px-2 space-y-1" aria-label="ناوبری اصلی">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setDrawerOpen(false)}
            className={[
              "flex items-center gap-3 px-3 py-3 rounded-medium text-labelLarge transition-colors touch-target",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-onSurfaceVariant hover:bg-onSurface/[0.05]",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon icon={item.icon} />
            <span>{item.titleFa}</span>
          </Link>
        );
      })}
    </nav>
  );
}
