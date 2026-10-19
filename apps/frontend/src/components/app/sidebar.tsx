// ============================================================
// LEGALIR — Desktop Sidebar Navigation
// ============================================================
// Surface: the shell's own solid navigation material (`--app-nav-*`). The
// previous version layered a translucent gradient under a `backdrop-blur-xl`,
// which made the compositor re-resolve the whole sidebar backdrop on every
// scroll frame of the page behind it — the most expensive thing the shell
// did on a mid-range phone — and read as decoration rather than navigation.
//
// State is carried by three agreeing signals, never colour alone: an MD3
// secondary-container fill, the brand-gold rail mark, and `aria-current`.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMainNavItems } from "@/lib/routes";
import type { UserRole } from "@/lib/routes";
import { useAppShellStore } from "@/lib/stores";
import { useMe } from "@/hooks/useDashboard";
import { UserAvatar } from "@/components/user/user-avatar";
import { useAuthStore } from "@/stores/auth-store";
import { SubscriptionStatusBadge } from "@/components/subscription/subscription-status";
import { CreateActionSheet } from "./create-action-sheet";
import { useCreateAction } from "./use-create-action";
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
  if (!Component) return <span className="w-5 h-5 flex items-center justify-center text-appnav-text-muted">•</span>;
  return (
    <span className={isActive ? "text-appnav-text" : "text-appnav-text-muted group-hover:text-appnav-text transition-colors duration-short3 ease-standard"}>
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

  // «ساخت جدید» is a verb, not a route: tapping it lands on /new (the full
  // launcher) and then raises the create sheet — the same flow as the centre
  // button of the mobile/PWA bar. It lives in the shared `useCreateAction`.
  const { open: createOpen, toggle: openCreate, close: closeCreate } = useCreateAction();

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

  return (
    <div className="flex h-full flex-col bg-appnav-bg">
      {/* Logo Area — cohesive brand lockup with optical alignment */}
      <div className="flex items-center justify-center px-5 py-5">
        {/* `h-9` (not the old `h-11`): the new lockup is wider, so at 36px it
            keeps ~30px of breathing room on each side of the rail instead of
            near-filling it (UI/UX review, 2026-10-12). */}
        <img src="/legalir-logo-sidebar.png" alt="LEGALIR" className="h-9 w-auto shrink-0" />
      </div>

      <div className="mx-4 border-b border-appnav-line" />

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-hide" aria-label="ناوبری اصلی">
        {desktopItems.map((item) => {
          const isActive = pathname === item.path
            || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));

          // «ساخت جدید» opens the create flow (navigate to /new, then raise the
          // sheet) rather than navigating to a page of its own. It still reads
          // as the current page when the user is sitting on /new.
          if (item.path === "/new") {
            const createActive = pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openCreate();
                }}
                aria-haspopup="dialog"
                aria-expanded={createOpen}
                aria-controls="create-action-sheet"
                aria-current={createActive ? "page" : undefined}
                className={[
                  "group relative flex w-full items-center gap-3 rounded-medium px-3.5 py-3 text-body-2 text-start",
                  "transition-colors duration-short3 ease-standard motion-reduce:transition-none",
                  "min-h-12 select-none",
                  createActive
                    ? "bg-appnav-active text-appnav-active-text font-semibold"
                    : "text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
                ].join(" ")}
              >
                {createActive && (
                  <span className="absolute end-1.5 top-3 bottom-3 w-[3px] rounded-full bg-appnav-mark" aria-hidden="true" />
                )}
                <NavIcon icon={item.icon} isActive={createActive} />
                <span className="truncate">{item.titleFa}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "group relative flex items-center gap-3 rounded-medium px-3.5 py-3 text-body-2",
                "transition-colors duration-short3 ease-standard motion-reduce:transition-none",
                "min-h-12 select-none",
                isActive
                  ? "bg-appnav-active text-appnav-active-text font-semibold"
                  : "text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute end-1.5 top-3 bottom-3 w-[3px] rounded-full bg-appnav-mark" aria-hidden="true" />
              )}
              <NavIcon icon={item.icon} isActive={isActive} />
              <span className="truncate">{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      {/* The shared «ساخت جدید» quick-action panel (portals to <body>). */}
      <CreateActionSheet open={createOpen} onClose={closeCreate} />

      {/* Footer: Settings + Subscription, then the support CTA.
          Both tiles sit on the quiet `--app-nav-pill` wash so the footer
          reads as one group without a second elevation. */}
      <div className="border-t border-appnav-line px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/profile"
            className={[
              "group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-medium px-2 py-3",
              "transition-colors duration-short3 ease-standard motion-reduce:transition-none",
              pathname === "/profile"
                ? "bg-appnav-active text-appnav-active-text font-semibold"
                : "bg-appnav-pill text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
            ].join(" ")}
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <UserAvatar
              avatarUrl={profile?.avatarUrl}
              name={displayName}
              size={32}
              className="ring-1 ring-[color:var(--app-nav-line)]"
              fallbackClassName="bg-[var(--brand-green)] text-white text-labelSmall font-bold"
            />
            <span className="max-w-full truncate text-caption font-medium">تنظیمات</span>
          </Link>

          <Link
            href="/subscription"
            className={[
              "group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-medium px-2 py-3",
              "transition-colors duration-short3 ease-standard motion-reduce:transition-none",
              pathname === "/subscription"
                ? "bg-appnav-active text-appnav-active-text font-semibold"
                : "bg-appnav-pill text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
            ].join(" ")}
            aria-current={pathname === "/subscription" ? "page" : undefined}
          >
            <span className="text-appnav-mark transition-opacity duration-short3 group-hover:opacity-80">
              <IconSubscription size={22} />
            </span>
            <span className="flex min-w-0 max-w-full items-center gap-1.5">
              <span className="truncate text-caption font-medium">اشتراک</span>
              <SubscriptionStatusBadge className="shrink-0" />
            </span>
          </Link>
        </div>

        {/* Support — prominent full-width CTA so it's easy to spot & tap */}
        <Link
          href="/support"
          onClick={() => setDrawerOpen(false)}
          className={[
            "group mt-2 flex min-h-[52px] items-center gap-3 rounded-medium px-3.5 py-3",
            "transition-colors duration-short3 ease-standard motion-reduce:transition-none active:scale-[0.99]",
            pathname === "/support"
              ? "bg-appnav-active text-appnav-active-text font-semibold"
              : "bg-appnav-accent-soft text-appnav-text hover:bg-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
          ].join(" ")}
          aria-current={pathname === "/support" ? "page" : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[#222E2D]">
            <IconPhone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-2 font-semibold">پشتیبانی</span>
            <span className="block truncate text-caption text-appnav-text-muted">
              پاسخگوی سوالات شما هستیم
            </span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-appnav-text-muted transition-colors duration-short3 group-hover:text-appnav-text" />
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

  return (
    <div className="flex h-full flex-col bg-appnav-bg">
      {/* User header in drawer */}
      <div className="border-b border-appnav-line px-4 py-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatarUrl={profile?.avatarUrl}
            name={displayName}
            size={48}
            className="ring-1 ring-[color:var(--app-nav-line)]"
            fallbackClassName="bg-[var(--brand-green)] text-white text-h3 font-bold"
          />
          <div className="min-w-0">
            <p className="truncate text-body-1 font-semibold text-appnav-text">{displayName}</p>
            <p className="text-caption text-appnav-text-muted">{session?.mobileDisplay}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const isActive = pathname === item.path
            || (item.path !== "/dashboard" && pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setDrawerOpen(false)}
              className={[
                "relative flex min-h-12 items-center gap-3 rounded-medium px-3.5 py-3 text-labelLarge",
                "transition-colors duration-short3 ease-standard motion-reduce:transition-none",
                isActive
                  ? "bg-appnav-active text-appnav-active-text font-semibold"
                  : "text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute end-1.5 top-3 bottom-3 w-[3px] rounded-full bg-appnav-mark"
                />
              )}
              <NavIcon icon={item.icon} isActive={isActive} />
              <span className="truncate">{item.titleFa}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-appnav-line px-2 py-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/settings"
            onClick={() => setDrawerOpen(false)}
            className={[
              "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-medium px-2 py-3",
              "text-labelLarge transition-colors duration-short3 motion-reduce:transition-none",
              pathname === "/settings"
                ? "bg-appnav-active text-appnav-active-text font-semibold"
                : "text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
            ].join(" ")}
            aria-current={pathname === "/settings" ? "page" : undefined}
          >
            <IconSettings size={22} className="text-appnav-text-muted" />
            <span className="max-w-full truncate">تنظیمات</span>
          </Link>
          <Link
            href="/subscription"
            onClick={() => setDrawerOpen(false)}
            className={[
              "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-medium px-2 py-3",
              "text-labelLarge transition-colors duration-short3 motion-reduce:transition-none",
              pathname === "/subscription"
                ? "bg-appnav-active text-appnav-active-text font-semibold"
                : "text-appnav-text-muted hover:bg-appnav-hover hover:text-appnav-text",
            ].join(" ")}
            aria-current={pathname === "/subscription" ? "page" : undefined}
          >
            <IconSubscription size={22} className="text-appnav-mark" />
            <span className="flex min-w-0 max-w-full items-center gap-1.5">
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
            "group mt-2 flex min-h-[52px] items-center gap-3 rounded-medium px-3.5 py-3",
            "transition-colors duration-short3 ease-standard motion-reduce:transition-none active:scale-[0.99]",
            pathname === "/support"
              ? "bg-appnav-active text-appnav-active-text font-semibold"
              : "bg-appnav-accent-soft text-appnav-text hover:bg-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]",
          ].join(" ")}
          aria-current={pathname === "/support" ? "page" : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[#222E2D]">
            <IconPhone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-2 font-semibold">پشتیبانی</span>
            <span className="block truncate text-caption text-appnav-text-muted">
              پاسخگوی سوالات شما هستیم
            </span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-appnav-text-muted transition-colors duration-short3 group-hover:text-appnav-text" />
        </Link>
      </div>
    </div>
  );
}
