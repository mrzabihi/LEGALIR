"use client";

import React, { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAppShellStore } from "./stores";
import { IconClose } from "./icons";
import { NavProgress } from "@/components/app/nav-progress";

// ============================================================
// AppShell — responsive layout container
// Desktop: sidebar + content
// Mobile: header + drawer + content
// ============================================================

interface AppShellProps {
  children: React.ReactNode;
  /** Navigation sidebar content (desktop) or drawer content (mobile) */
  sidebar?: React.ReactNode;
  /** Top bar content */
  topBar?: React.ReactNode;
  /** Bottom navigation (visible only on mobile/tablet) */
  bottomNav?: React.ReactNode;
}

export function AppShell({ children, sidebar, topBar, bottomNav }: AppShellProps) {
  const { drawerOpen, setDrawerOpen } = useAppShellStore();
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  // Reset the content scroll container on route change. The scrollable
  // element is <main id="main-content">, not the window, so Next.js's
  // automatic scroll-to-top does not apply — without this, a new page
  // inherits the previous page's scroll offset.
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo(0, 0);
  }, [pathname]);

  // Close drawer on desktop resize
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setDrawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close drawer on Escape key
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    },
    [drawerOpen, setDrawerOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [handleEscapeKey]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <NavProgress />

      {/* Desktop Sidebar — the app-navigation surface is opaque by design:
          no backdrop filter, so a scroll inside <main> never forces the
          compositor to re-resolve this layer's backdrop. */}
      {sidebar && (
        <aside className="hidden w-[240px] shrink-0 flex-col border-e border-appnav-line bg-appnav-bg desktop:flex laptop:w-[260px] wide:w-[280px]">
          {sidebar}
        </aside>
      )}

      {/* Mobile Drawer Overlay */}
      {sidebar && drawerOpen && (
        <div className="desktop:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-scrim animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mobile-nav-drawer"
            className="absolute bottom-0 start-0 top-0 flex w-[85vw] max-w-[320px] flex-col bg-appnav-bg shadow-elevation-16 animate-slide-in-end"
            role="dialog"
            aria-modal="true"
            aria-label="منوی موبایل"
          >
            <div className="flex items-center justify-between border-b border-appnav-line p-4">
              <img
                src="/legalir-logo-dashboard.png"
                alt="LEGALIR"
                className="h-10 w-auto"
              />
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-appnav-text transition-colors duration-short3 hover:bg-appnav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-nav-mark)]"
                aria-label="بستن منو"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto safe-bottom">{sidebar}</div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        {/* Top Bar — slim, uniform chrome. Height stays compact on phones
            (48px) and rises one step on desktop (56px); the components inside
            never change, so the header reads the same at every width. */}
        {topBar && (
          <header className="relative z-30 shrink-0 h-12 desktop:h-14 border-b border-divider/70 bg-surface flex items-center px-2 tablet:px-4 gap-1 tablet:gap-2">
            {topBar}
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-24 desktop:pb-0" id="main-content">
          {children}
        </main>

        {/* Mobile Bottom Navigation (floating pill, fixed-positioned) */}
        {bottomNav && (
          <div className="desktop:hidden shrink-0 h-0 pointer-events-none">
            {bottomNav}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// BottomNav — mobile bottom navigation bar
// ============================================================

interface BottomNavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: number | string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeKey?: string;
}

export function BottomNav({ items, activeKey }: BottomNavProps) {
  return (
    <div className="flex items-center justify-around h-16">
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={item.onClick}
            className={[
              "flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-full px-2",
              "transition-colors duration-short3",
              isActive ? "text-primary" : "text-onSurfaceVariant",
            ].join(" ")}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative">
              {item.icon}
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -end-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-error text-[var(--color-on-error)] text-[10px] px-1">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-labelSmall">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
