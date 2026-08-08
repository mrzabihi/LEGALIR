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
  if (!Component) return <span className="w-6 h-6 flex items-center justify-center text-neutral-400">•</span>;
  return <Component size={20} />;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getMainNavItems(userRole);
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);

  return (
    <div className="flex flex-col h-full bg-white border-e border-neutral-200">
      {/* Logo Area */}
      <div className="flex items-center px-5 py-4 border-b border-neutral-100">
        <img
          src="/legalir-logo.png"
          alt="LEGALIR"
          className="h-14 w-auto"
        />
        <span className="text-h3 text-primary-800 font-bold mr-3 hidden laptop:inline">LEGALIR</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "flex items-center gap-3 px-4 py-3 rounded-xl text-body-2 transition-all duration-200",
                "min-h-[48px] select-none",
                isActive
                  ? "bg-primary-50 text-primary-700 font-semibold shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={isActive ? "text-primary-700" : "text-neutral-400"}>
                <NavIcon icon={item.icon} />
              </span>
              <span>{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer area — subscription link highlighted */}
      <div className="px-3 py-4 border-t border-neutral-100">
        <Link
          href="/subscription"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-body-2 text-neutral-600 hover:bg-secondary-50 hover:text-secondary-700 transition-colors min-h-[48px]"
        >
          <span className="text-secondary-500">
            <NavIcon icon="WorkspacePremium" />
          </span>
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
                ? "bg-primary-50 text-primary-700 font-medium border-s-2 border-secondary-600"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 border-s-2 border-transparent",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={isActive ? "text-primary-700" : "text-neutral-500"}>
              <NavIcon icon={item.icon} />
            </span>
            <span>{item.titleFa}</span>
          </Link>
        );
      })}
    </nav>
  );
}
