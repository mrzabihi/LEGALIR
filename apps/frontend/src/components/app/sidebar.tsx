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
import { SubscriptionStatusBadge } from "@/components/subscription/subscription-status";
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
  IconCalculator,
  IconBalance,
  IconLawBook,
  IconChevronRight,
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
  Calculator: IconCalculator,
  Balance: IconBalance,
  LawBook: IconLawBook,
};

function NavIcon({ icon, isActive }: { icon?: string; isActive: boolean }) {
  const Component = icon ? NAV_ICON_MAP[icon] : null;
  if (!Component) return <span className="w-5 h-5 flex items-center justify-center text-glass-ivory-muted">•</span>;
  return (
    <span className={isActive ? "text-glass-ivory" : "text-glass-ivory-muted group-hover:text-glass-ivory transition-colors duration-short4 ease-standard"}>
      <Component size={20} />
    </span>
  );
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  // Settings, Support & Subscription live in the footer, not the main nav list.
  const navItems = getMainNavItems(userRole).filter(
    (item) =>
      item.path !== "/profile" &&
      item.path !== "/support" &&
      item.path !== "/subscription"
  );
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);

  // The lawyer workspace is only meaningful for LAWYER accounts, so it is
  // injected here rather than in the shared route registry (which has no
  // notion of the platform role).
  const isLawyer = meData?.user?.role === "LAWYER";
  const items = isLawyer
    ? [
        ...navItems,
        { path: "/lawyer", titleFa: "میزکار وکیل", access: "user" as const, icon: "Balance" },
      ]
    : navItems;

  // Blog is a public marketing surface, so it is not part of the shared
  // route registry's app nav. Pinned as the last item of the desktop sidebar
  // only — the responsive drawer already exposes it.
  const desktopItems = [
    ...items,
    { path: "/blog", titleFa: "وبلاگ", access: "user" as const, icon: "LawBook" },
  ];

  const profile = meData?.profile;
  const displayName = profile?.displayName ?? session?.mobileDisplay ?? "کاربر";
  const avatarInitial = (displayName ?? "ک")[0]!;

  return (
    <div className="flex flex-col h-full bg-glass-surface-strong [background-image:var(--sidebar-gradient)] backdrop-blur-xl">
      {/* Logo Area — cohesive brand lockup with optical alignment */}
      <div className="flex items-center justify-center px-5 py-5">
        <img src="/legalir-logo-dashboard.png" alt="LEGALIR" className="h-11 w-auto shrink-0" />
      </div>

      <div className="mx-4 border-b border-glass-border" />

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-hide" aria-label="ناوبری اصلی">
        {desktopItems.map((item) => {
          const isActive = pathname === item.path
            || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "group flex items-center gap-3 px-4 py-3 rounded-xl text-body-2",
                "transition-all duration-short4 ease-standard",
                "min-h-[48px] select-none relative overflow-hidden",
                isActive
                  ? "bg-glass-state-strong text-glass-ivory font-semibold"
                  : "text-glass-ivory-muted hover:bg-glass-state hover:text-glass-ivory",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute end-0 top-3 bottom-3 w-0.5 rounded-full bg-secondary-400" aria-hidden="true" />
              )}
              <NavIcon icon={item.icon} isActive={isActive} />
              <span className="truncate">{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: Profile + Subscription cards (side by side) */}
      <div className="px-3 py-3 border-t border-glass-border">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/profile"
            className={[
              "group flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 min-h-[72px]",
              "transition-all duration-short4 ease-standard",
              pathname === "/profile"
                ? "bg-glass-state-strong text-glass-ivory"
                : "bg-[var(--sidebar-profile-bg)] text-glass-ivory-muted hover:bg-glass-state hover:text-glass-ivory",
            ].join(" ")}
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-[rgba(255,249,240,0.35)] flex items-center justify-center text-white text-labelSmall font-bold shrink-0">
              {avatarInitial}
            </span>
            <span className="text-caption font-medium truncate max-w-full">تنظیمات</span>
          </Link>

          <Link
            href="/subscription"
            className={[
              "group flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 min-h-[72px]",
              "transition-all duration-short4 ease-standard",
              pathname === "/subscription"
                ? "bg-glass-state-strong text-glass-ivory"
                : "bg-[var(--sidebar-profile-bg)] text-glass-ivory-muted hover:bg-glass-state hover:text-glass-ivory",
            ].join(" ")}
            aria-current={pathname === "/subscription" ? "page" : undefined}
          >
            <span className="text-secondary-300 group-hover:text-secondary-200 transition-colors duration-short4">
              <IconSubscription size={22} />
            </span>
            <span className="flex items-center gap-1.5 min-w-0 max-w-full">
              <span className="text-caption font-medium truncate">اشتراک</span>
              <SubscriptionStatusBadge className="shrink-0" />
            </span>
          </Link>
        </div>

        {/* Support — prominent full-width CTA so it's easy to spot & tap */}
        <Link
          href="/support"
          onClick={() => setDrawerOpen(false)}
          className={[
            "group mt-2 flex items-center gap-3 rounded-xl px-3.5 py-3 min-h-[52px]",
            "transition-all duration-short4 ease-standard active:scale-[0.98]",
            pathname === "/support"
              ? "bg-glass-state-strong text-glass-ivory ring-1 ring-secondary-400/40"
              : "bg-[color-mix(in_srgb,var(--color-secondary)_16%,transparent)] text-glass-ivory hover:bg-[color-mix(in_srgb,var(--color-secondary)_26%,transparent)]",
          ].join(" ")}
          aria-current={pathname === "/support" ? "page" : undefined}
        >
          <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center text-white shadow-elevation-1 group-hover:scale-105 transition-transform duration-short4 ease-standard">
            <IconPhone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-2 font-semibold truncate">پشتیبانی</span>
            <span className="block text-caption text-glass-ivory-muted truncate">پاسخگوی سوالات شما هستیم</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-glass-ivory-muted group-hover:text-glass-ivory transition-colors duration-short4" />
        </Link>
      </div>
    </div>
  );
}

/** Mobile drawer version */
export function SidebarMobile({ userRole }: SidebarProps) {
  const pathname = usePathname();
  // Settings & Support live in the footer, not the main nav list.
  const navItems = getMainNavItems(userRole).filter(
    (item) => item.path !== "/profile" && item.path !== "/support"
  );
  const setDrawerOpen = useAppShellStore((s) => s.setDrawerOpen);
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);

  const profile = meData?.profile;
  const displayName = profile?.displayName ?? session?.mobileDisplay ?? "کاربر";
  const avatarInitial = (displayName ?? "ک")[0]!;

  return (
    <div className="flex flex-col h-full bg-glass-surface-strong [background-image:var(--sidebar-gradient)]">
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

      <div className="px-2 py-3 border-t border-divider">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/settings"
            onClick={() => setDrawerOpen(false)}
            className={[
              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 min-h-[72px]",
              "text-labelLarge transition-colors touch-target",
              pathname === "/settings"
                ? "bg-primary-50 text-primary-700 font-semibold"
                : "text-neutral-600 hover:bg-neutral-100",
            ].join(" ")}
            aria-current={pathname === "/settings" ? "page" : undefined}
          >
            <IconSettings size={22} className="text-neutral-400" />
            <span className="truncate max-w-full">تنظیمات</span>
          </Link>
          <Link
            href="/subscription"
            onClick={() => setDrawerOpen(false)}
            className={[
              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 min-h-[72px]",
              "text-labelLarge transition-colors touch-target",
              pathname === "/subscription"
                ? "bg-primary-50 text-primary-700 font-semibold"
                : "text-secondary-700 hover:bg-amber-50",
            ].join(" ")}
            aria-current={pathname === "/subscription" ? "page" : undefined}
          >
            <IconSubscription size={22} className="text-secondary-500" />
            <span className="flex items-center gap-1.5 min-w-0 max-w-full">
              <span className="truncate">اشتراک</span>
              <SubscriptionStatusBadge className="shrink-0" />
            </span>
          </Link>
        </div>

        {/* Support — prominent full-width CTA so it's easy to spot & tap */}
        <Link
          href="/support"
          onClick={() => setDrawerOpen(false)}
          className={[
            "group mt-2 flex items-center gap-3 rounded-xl px-3.5 py-3 min-h-[52px]",
            "transition-all duration-short4 ease-standard active:scale-[0.98] touch-target",
            pathname === "/support"
              ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200"
              : "bg-secondary-50 text-secondary-800 hover:bg-secondary-100",
          ].join(" ")}
          aria-current={pathname === "/support" ? "page" : undefined}
        >
          <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center text-white shadow-elevation-1 group-hover:scale-105 transition-transform duration-short4 ease-standard">
            <IconPhone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-2 font-semibold truncate">پشتیبانی</span>
            <span className="block text-caption text-secondary-700/70 truncate">پاسخگوی سوالات شما هستیم</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-secondary-500 group-hover:text-secondary-700 transition-colors duration-short4" />
        </Link>
      </div>
    </div>
  );
}
