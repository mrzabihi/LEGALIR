"use client";

import React, { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAppShellStore } from "./stores";
import { useThemeStore } from "@/stores/theme-store";
import { IconMenu, IconLightMode, IconDarkMode, IconClose } from "./icons";

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
  const { drawerOpen, setDrawerOpen, toggleDrawer } = useAppShellStore();
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

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
      {/* Desktop Sidebar */}
      {sidebar && (
        <aside className="hidden desktop:flex flex-col w-[240px] laptop:w-[260px] wide:w-[280px] shrink-0 border-e border-divider bg-surface">
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
            className="absolute top-0 bottom-0 end-0 w-[85vw] max-w-[320px] bg-surface shadow-elevation-16 animate-slide-in-end flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="منوی موبایل"
          >
            <div className="flex items-center justify-between p-4 border-b border-divider">
              <span className="text-titleMedium text-onSurface">LEGALIR</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
                aria-label="بستن منو"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto safe-bottom">{sidebar}</div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        {/* Top Bar */}
        {topBar && (
          <header className="shrink-0 h-16 border-b border-divider bg-surface flex items-center px-4 gap-3">
            {sidebar && (
              <button
                onClick={toggleDrawer}
                className="desktop:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
                aria-label="باز کردن منو"
                aria-expanded={drawerOpen}
              >
                <IconMenu size={20} />
              </button>
            )}
            {topBar}
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto" id="main-content">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        {bottomNav && (
          <nav className="desktop:hidden shrink-0 border-t border-divider bg-surface safe-bottom">
            {bottomNav}
          </nav>
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
                <span className="absolute -top-1.5 -end-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-error text-onError text-[10px] px-1">
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

// ============================================================
// ThemeToggle — switches between light and dark
// ============================================================

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors"
      aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
    >
      {theme === "light" ? <IconDarkMode size={20} /> : <IconLightMode size={20} />}
    </button>
  );
}
