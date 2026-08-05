// ============================================================
// LEGALIR — Authenticated App Layout
// Combines AppShell with Sidebar, TopBar, BottomNav
// ============================================================

"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import { AppShell } from "@/lib/layout-primitives";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import type { UserRole } from "@/lib/routes";
import { OfflineBanner } from "@/components/shared";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: meData } = useMe();

  // Determine user role — default to "user" if not yet loaded
  const userRole: UserRole = meData?.role === "admin" ? "admin" : "user";

  // If not authenticated, don't render the shell (middleware should redirect)
  if (!isAuthenticated()) {
    return <>{children}</>;
  }

  const sidebar = <Sidebar userRole={userRole} />;
  const _sidebarMobile = null;
  const topBar = <TopBar />;
  const bottomNav = <BottomNav userRole={userRole} />;

  return (
    <>
      <OfflineBanner />
      <AppShell sidebar={sidebar} topBar={topBar} bottomNav={bottomNav}>
        {children}
      </AppShell>
    </>
  );
}
