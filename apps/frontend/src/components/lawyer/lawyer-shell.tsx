// ============================================================
// LEGALIR — Lawyer workbench shell (sidebar + top bar)
// ============================================================
// The chrome around every lawyer page. It mirrors the admin panel's
// information architecture — a collapsible rail, a sticky header, a user
// menu — so the workbench feels like the same product, WITHOUT importing a
// single admin tool or datum.
//
// The sidebar renders from LAWYER_NAV and filters it by the caller's
// permissions. That filter is a UX affordance only: every
// `/api/v1/lawyer/**` route resolves the lawyer from the session and
// re-checks the permission server-side (lib/lawyer-portal/http.ts).
//
// A signed-in non-lawyer sees a clear «دسترسی محدود» card. The server layout
// already redirects that case; this is the defensive second line.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_FA, roleHasPermission, type Permission } from "@legalir/types";
import {
  LAWYER_NAV,
  activeLawyerNavKey,
  lawyerSectionTitle,
  type LawyerNavItem,
} from "@/lib/lawyer-portal/nav";
import { useMe } from "@/hooks/useDashboard";
import { useLogout } from "@/lib/auth/use-auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  IconDashboard,
  IconBalance,
  IconPerson,
  IconCalculator,
  IconMenu,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconLogout,
  IconShield,
} from "@/lib/icons";

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const ICONS: Record<string, IconComponent> = {
  Dashboard: IconDashboard,
  Balance: IconBalance,
  Person: IconPerson,
  Calculator: IconCalculator,
};

const RAIL_W = "w-20";
const FULL_W = "w-72";
const RAIL_MS = "laptop:ms-20";
const FULL_MS = "laptop:ms-72";

const COLLAPSE_KEY = "legalir.lawyer.sidebar.collapsed";

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable — stay expanded */
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

function NavItemRow({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: LawyerNavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.titleFa : undefined}
      className={[
        "group relative flex items-center rounded-medium transition-colors duration-short3 ease-standard motion-reduce:transition-none",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-2",
        isActive
          ? "bg-primary-soft text-primary"
          : "text-on-surface-variant hover:bg-surface-hover hover:text-on-surface",
      ].join(" ")}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-primary"
        />
      )}
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium transition-[background-color,color,transform] duration-short3 ease-standard can-hover:group-hover:scale-[1.04] motion-reduce:transition-none ${
          isActive
            ? "bg-primary text-on-primary"
            : "bg-surface-container text-on-surface-variant group-hover:text-primary"
        }`}
      >
        {Icon ? <Icon size={18} /> : <span className="inline-block h-4 w-4" />}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-body-2 ${isActive ? "font-semibold" : "font-medium"}`}
          >
            {item.titleFa}
          </span>
          <span className="block truncate text-caption text-muted">{item.hintFa}</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({
  collapsed,
  can,
  onNavigate,
}: {
  collapsed: boolean;
  can: (permission: Permission) => boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeKey = activeLawyerNavKey(pathname);
  const items = LAWYER_NAV.filter((item) => can(item.permission));

  return (
    <nav
      className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? "px-2" : "px-2.5"}`}
      aria-label="ناوبری میزکار وکیل"
    >
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItemRow
            key={item.key}
            item={item}
            isActive={item.key === activeKey}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Header — user menu
// ---------------------------------------------------------------------------

function UserMenu({
  roleFa,
  name,
  avatarUrl,
}: {
  roleFa: string;
  name: string;
  avatarUrl?: string | null;
}) {
  const { logout, isPending } = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="منوی کاربری"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2.5 rounded-full border p-1 transition-colors tablet:pe-3 ${
          open ? "border-primary-200 bg-primary-soft" : "border-divider hover:bg-surface-hover"
        }`}
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          name={name}
          size={32}
          fallbackClassName="bg-primary text-on-primary text-caption font-bold"
        />
        <span className="hidden text-start tablet:block">
          <span className="block max-w-[140px] truncate text-caption font-semibold text-on-surface">
            {name}
          </span>
          <span className="block text-caption text-muted">{roleFa}</span>
        </span>
      </button>

      {open && (
        <div
          className="absolute end-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-large border border-divider bg-surface shadow-elevation-8"
          role="menu"
        >
          <div className="border-b border-divider bg-surface-container-low px-4 py-3">
            <p className="truncate text-body-2 font-semibold text-on-surface">{name}</p>
            <p className="text-caption text-muted">{roleFa}</p>
          </div>
          <div className="py-1.5">
            <Link
              href="/lawyer/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-body-2 text-on-surface-variant transition-colors hover:bg-surface-hover"
            >
              <IconPerson size={17} className="text-outline" /> پروفایل حرفه‌ای
            </Link>
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-body-2 text-on-surface-variant transition-colors hover:bg-surface-hover"
            >
              <IconHome size={17} className="text-outline" /> بازگشت به اپلیکیشن
            </Link>
          </div>
          <div className="border-t border-divider py-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-body-2 text-error transition-colors hover:bg-error-soft disabled:opacity-60"
            >
              <IconLogout size={17} /> {isPending ? "در حال خروج…" : "خروج از حساب"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function LawyerShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const role = me.data?.user?.role ?? null;
  const can = (permission: Permission) =>
    role ? roleHasPermission(role, permission) : false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const pathname = usePathname();
  const sectionTitle = lawyerSectionTitle(pathname);
  const roleFa = role ? (ROLE_FA[role] ?? role) : "";
  const displayName =
    me.data?.profile?.displayName ?? me.data?.user?.mobileDisplay ?? "وکیل";

  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low p-6" dir="rtl">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-56 rounded-medium bg-surface-container-high skeleton-shimmer" />
          <div className="mt-6 grid grid-cols-2 gap-3 tablet:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-large bg-surface-container-high skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (role !== "LAWYER") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-surface-container-low p-6"
        dir="rtl"
      >
        <div className="max-w-md rounded-large border border-divider bg-surface p-8 text-center shadow-elevation-1">
          <IconShield size={36} className="mx-auto mb-4 text-muted" />
          <h1 className="text-h3 font-bold text-onSurface">دسترسی محدود</h1>
          <p className="mt-2 text-body-2 text-muted">
            میزکار وکیل فقط برای حساب‌های وکیل در دسترس است.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 rounded-medium border border-divider px-4 py-2 text-body-2 font-medium text-on-surface-variant hover:bg-surface-hover"
          >
            <IconHome size={16} /> بازگشت به اپلیکیشن
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low" dir="rtl">
      {/* Desktop sidebar — fixed on the inline-start edge (right in RTL). */}
      <aside
        className={`fixed inset-y-0 start-0 z-30 hidden flex-col border-e border-divider bg-surface laptop:flex ${
          collapsed ? RAIL_W : FULL_W
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-divider ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <Link href="/lawyer" className="flex items-center gap-2" aria-label="میزکار وکیل LEGALIR">
            <img
              src="/legalir-logo-dashboard.png"
              alt="LEGALIR"
              className={`w-auto ${collapsed ? "h-7" : "h-8"}`}
            />
            {!collapsed && (
              <span className="text-body-2 font-bold text-onSurface">میزکار وکیل</span>
            )}
          </Link>
        </div>

        <SidebarNav collapsed={collapsed} can={can} />

        <div className="shrink-0 border-t border-divider p-2.5">
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between rounded-medium bg-surface-container-low px-3 py-2">
              <span className="text-caption text-muted">نقش شما</span>
              <span className="text-caption font-semibold text-on-surface-variant">{roleFa}</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            className={`flex w-full items-center rounded-medium px-2.5 py-2 text-caption font-medium text-muted transition-colors hover:bg-surface-hover hover:text-on-surface ${
              collapsed ? "justify-center" : "gap-2"
            }`}
          >
            {collapsed ? (
              <IconChevronRight size={18} />
            ) : (
              <>
                <IconChevronLeft size={18} />
                جمع کردن
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer — same nav, slides in from the start edge. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 laptop:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 start-0 flex w-80 max-w-[85%] flex-col border-e border-divider bg-surface">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-divider px-4">
              <div className="flex items-center gap-2">
                <img src="/legalir-logo-dashboard.png" alt="LEGALIR" className="h-8 w-auto" />
                <span className="text-body-2 font-bold text-onSurface">میزکار وکیل</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-hover"
              >
                <IconClose size={20} />
              </button>
            </div>
            <SidebarNav
              collapsed={false}
              can={can}
              onNavigate={() => setDrawerOpen(false)}
            />
            <div className="shrink-0 border-t border-divider p-3">
              <div className="flex items-center justify-between rounded-medium bg-surface-container-low px-3 py-2">
                <span className="text-caption text-muted">نقش شما</span>
                <span className="text-caption font-semibold text-on-surface-variant">{roleFa}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main column — offset by the sidebar width on laptop+. */}
      <div className={`${collapsed ? RAIL_MS : FULL_MS} transition-[margin] duration-medium2`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-divider bg-surface px-4 backdrop-blur tablet:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="منو"
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-hover laptop:hidden"
          >
            <IconMenu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="hidden text-caption text-muted tablet:block">میزکار حرفه‌ای لیگالیر</p>
            <h1 className="truncate text-body-1 font-bold text-onSurface">{sectionTitle}</h1>
          </div>

          <NotificationBell />

          <div className="mx-1 hidden h-8 w-px bg-divider tablet:block" aria-hidden="true" />

          <UserMenu
            roleFa={roleFa}
            name={displayName}
            avatarUrl={me.data?.profile?.avatarUrl}
          />
        </header>

        <main className="mx-auto max-w-[1440px] p-4 tablet:p-6">{children}</main>
      </div>
    </div>
  );
}
