// ============================================================
// LEGALIR — Desktop Sidebar Navigation
// Professional design with gradient active states,
// profile section, and smooth transitions.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMainNavItems } from "@/lib/routes";
import type { UserRole } from "@/lib/routes";
import { useAppShellStore } from "@/lib/stores";
import { useMe } from "@/hooks/useDashboard";
import { useAuthStore } from "@/stores/auth-store";
import {
  IconHome,
  IconServices,
  IconDashboard,
  IconAdd,
  IconMemory,
  IconHistory,
  IconDocument,
  IconContract,
  IconSubscription,
  IconPerson,
  IconPhone,
  IconSettings,
} from "@/lib/icons";

interface SidebarProps {
  userRole: UserRole;
}

const NAV_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Home: IconHome,
  Services: IconServices,
  Dashboard: IconDashboard,
  Add: IconAdd,
  Memory: IconMemory,
  History: IconHistory,
  Description: IconDocument,
  Article: IconContract,
  WorkspacePremium: IconSubscription,
  Person: IconPerson,
  Phone: IconPhone,
};

function NavIcon({ icon, isActive }: { icon?: string; isActive: boolean }) {
  const Component = icon ? NAV_ICON_MAP[icon] : null;
  if (!Component) return <span className="w-5 h-5 flex items-center justify-center text-muted">•</span>;
  return (
    <span className={isActive ? "text-primary-600" : "text-neutral-400 group-hover:text-neutral-600 transition-colors duration-200"}>
      <Component size={20} />
    </span>
  );
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getMainNavItems(userRole);
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);

  const profile = meData?.profile;
  const displayName = profile?.displayName ?? session?.mobileDisplay ?? "کاربر";
  const avatarInitial = (displayName ?? "ک")[0]!;

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Logo Area — cohesive brand lockup with optical alignment */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/legalir-logo.png" alt="LEGALIR" className="h-11 w-auto shrink-0" />
        <span className="text-h3 text-primary-800 font-extrabold hidden laptop:inline tracking-tight translate-y-[7px]">
          لیگالیر
        </span>
      </div>

      <div className="mx-4 border-b border-divider" />

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-hide" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const isActive = pathname === item.path
            || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "group flex items-center gap-3 px-4 py-3 rounded-xl text-body-2",
                "transition-all duration-200 ease-standard",
                "min-h-[48px] select-none relative overflow-hidden",
                isActive
                  ? "bg-primary-50/80 text-primary-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute end-0 top-3 bottom-3 w-0.5 rounded-full bg-primary-600" aria-hidden="true" />
              )}
              <NavIcon icon={item.icon} isActive={isActive} />
              <span className="truncate">{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: Subscription + Profile */}
      <div className="px-3 py-3 border-t border-divider space-y-1">
        <Link
          href="/subscription"
          className="group flex items-center gap-3 px-4 py-3 rounded-xl text-body-2 text-neutral-600 hover:bg-amber-50 hover:text-secondary-700 transition-all duration-200 min-h-[48px]"
        >
          <span className="text-secondary-500 group-hover:text-secondary-600 transition-colors">
            <IconSubscription size={20} />
          </span>
          <span>اشتراک</span>
        </Link>

        <Link
          href="/profile"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-50 transition-all duration-200 min-h-[48px]"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white text-labelSmall font-bold shadow-elevation-2 shrink-0">
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body-2 text-on-surface font-medium truncate">{displayName}</p>
            <p className="text-caption text-muted truncate">مشاهده پروفایل</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

/** Mobile drawer version */
export function SidebarMobile({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getMainNavItems(userRole);
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);

  const profile = meData?.profile;
  const displayName = profile?.displayName ?? session?.mobileDisplay ?? "کاربر";
  const avatarInitial = (displayName ?? "ک")[0]!;

  return (
    <div className="flex flex-col h-full">
      {/* User header in drawer */}
      <div className="px-4 py-4 border-b border-divider">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white text-h3 font-bold shadow-elevation-3 shrink-0">
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <p className="text-body-1 text-on-surface font-semibold truncate">{displayName}</p>
            <p className="text-caption text-muted">{session?.mobileDisplay}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-auto py-2 px-2 space-y-0.5" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const isActive = pathname === item.path
            || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "flex items-center gap-3 px-4 py-3.5 rounded-xl text-labelLarge transition-all duration-200 touch-target",
                isActive
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon icon={item.icon} isActive={isActive} />
              <span>{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-divider space-y-0.5">
        <Link
          href="/settings"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-labelLarge text-neutral-600 hover:bg-neutral-100 transition-colors touch-target"
        >
          <IconSettings size={20} className="text-neutral-400" />
          <span>تنظیمات</span>
        </Link>
        <Link
          href="/subscription"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-labelLarge text-secondary-700 hover:bg-amber-50 transition-colors touch-target"
        >
          <IconSubscription size={20} className="text-secondary-500" />
          <span>اشتراک</span>
        </Link>
      </div>
    </div>
  );
}
