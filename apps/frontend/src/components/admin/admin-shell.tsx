// ============================================================
// LEGALIR — Admin panel shell (sidebar + top bar)
// ============================================================
// The chrome around every admin page. The sidebar is rendered from
// ADMIN_NAV and filtered by the caller's permissions — a UX affordance
// only. The server re-checks each section's permission on its API, so a
// hidden link is never the authorization boundary.
//
// Unauthorized (non-staff) users see a clear «دسترسی محدود» screen rather
// than an empty panel.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, activeAdminNavKey } from "@/lib/admin-nav";
import { useAdminMe } from "@/hooks/useAdmin";
import { ROLE_FA } from "@legalir/types";
import {
  IconDashboard,
  IconUsers,
  IconBalance,
  IconLawBook,
  IconServices,
  IconSubscription,
  IconCoin,
  IconBolt,
  IconDatabase,
  IconCalculator,
  IconHeadset,
  IconDocument,
  IconDownload,
  IconShield,
  IconSettings,
  IconHome,
  IconMenu,
  IconClose,
  IconChevronLeft,
} from "@/lib/icons";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Dashboard: IconDashboard,
  Users: IconUsers,
  Balance: IconBalance,
  LawBook: IconLawBook,
  Services: IconServices,
  Subscription: IconSubscription,
  Coin: IconCoin,
  Bolt: IconBolt,
  Database: IconDatabase,
  Calculator: IconCalculator,
  Headset: IconHeadset,
  Document: IconDocument,
  Download: IconDownload,
  Shield: IconShield,
  Settings: IconSettings,
};

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAdminMe();
  const activeKey = activeAdminNavKey(pathname);
  const items = ADMIN_NAV.filter((item) => can(item.permission));

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="ناوبری پنل مدیریت">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isActive = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.path}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={[
              "group mb-0.5 flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-hover",
            ].join(" ")}
          >
            <span className="mt-0.5 shrink-0">
              {Icon ? <Icon size={18} /> : <span className="inline-block h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-body-2 ${isActive ? "font-semibold" : ""}`}>
                {item.titleFa}
              </span>
              <span className="block truncate text-caption text-muted">{item.hintFa}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isStaff, isLoading, role } = useAdminMe();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const activeKey = activeAdminNavKey(pathname);
  const activeItem = ADMIN_NAV.find((i) => i.key === activeKey);
  const roleFa = role ? (ROLE_FA[role] ?? role) : "";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low p-6" dir="rtl">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-56 rounded-medium bg-surface-container-high skeleton-shimmer" />
          <div className="mt-6 grid grid-cols-2 gap-3 tablet:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-large bg-surface-container-high skeleton-shimmer"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-surface-container-low p-6"
        dir="rtl"
      >
        <div className="max-w-md rounded-large border border-divider bg-surface p-8 text-center">
          <IconShield size={36} className="mx-auto mb-4 text-muted" />
          <h1 className="text-h3 text-onSurface font-bold">دسترسی محدود</h1>
          <p className="mt-2 text-body-2 text-muted">
            این پنل فقط برای کارکنان و مدیران پلتفرم در دسترس است.
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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 end-0 z-30 hidden w-72 flex-col border-s border-divider bg-surface tablet:flex">
        <div className="flex items-center justify-between border-b border-divider px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/legalir-logo-dashboard.png" alt="LEGALIR" className="h-8 w-auto" />
            <span className="text-body-2 font-bold text-onSurface">پنل مدیریت</span>
          </div>
        </div>
        <SidebarNav />
        <div className="border-t border-divider px-3 py-3">
          <div className="mb-2 flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2">
            <span className="text-caption text-muted">نقش شما</span>
            <span className="text-caption font-semibold text-on-surface-variant">{roleFa}</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-body-2 text-on-surface-variant hover:bg-surface-hover"
          >
            <IconHome size={18} /> بازگشت به اپلیکیشن
          </Link>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 tablet:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 end-0 flex w-80 max-w-[85%] flex-col bg-surface">
            <div className="flex items-center justify-between border-b border-divider px-4 py-4">
              <span className="text-body-1 font-bold text-onSurface">پنل مدیریت</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-hover"
              >
                <IconClose size={20} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="tablet:me-72">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-divider bg-surface/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="منو"
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-hover tablet:hidden"
          >
            <IconMenu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">پنل مدیریت LEGALIR</p>
            <h1 className="truncate text-body-1 font-bold text-onSurface">
              {activeItem?.titleFa ?? "مدیریت"}
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 rounded-medium border border-divider px-3 py-1.5 text-caption font-medium text-on-surface-variant hover:bg-surface-hover tablet:inline-flex"
          >
            اپلیکیشن <IconChevronLeft size={14} />
          </Link>
        </header>
        <main className="p-4 tablet:p-6">{children}</main>
      </div>
    </div>
  );
}
