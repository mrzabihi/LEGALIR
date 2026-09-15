// ============================================================
// LEGALIR — Authenticated App Layout
// Combines AppShell with Sidebar, TopBar, BottomNav
// ============================================================

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import { AppShell } from "@/lib/layout-primitives";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import type { UserRole } from "@/lib/routes";
import { OfflineBanner } from "@/components/shared";
import { DailyVisitToast } from "@/components/rewards/daily-visit-toast";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: meData } = useMe();

  // The auth store is persisted to localStorage, which is unavailable during SSR.
  // On the server `isAuthenticated()` is always false, so rendering the shell
  // immediately would produce different HTML than the client (hydration mismatch).
  // Defer the authenticated branch until after mount so server + first client
  // render agree, then switch to the shell once the session is rehydrated.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine user role — default to "user" if not yet loaded
  const userRole: UserRole = meData?.role === "admin" ? "admin" : "user";

  // If not authenticated (or still hydrating), don't render the shell
  // (middleware should redirect).
  if (!mounted || !isAuthenticated()) {
    return <>{children}</>;
  }

  const sidebar = <Sidebar userRole={userRole} />;
  const topBar = <TopBar />;
  const bottomNav = <BottomNav userRole={userRole} />;

  return (
    <>
      <OfflineBanner />
      <AppShell sidebar={sidebar} topBar={topBar} bottomNav={bottomNav}>
        {children}
      </AppShell>
      <DailyVisitToast />
    </>
  );
}
