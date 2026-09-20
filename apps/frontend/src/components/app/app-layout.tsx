// ============================================================
// LEGALIR — Authenticated App Layout
// Combines AppShell with Sidebar, TopBar, BottomNav
// ============================================================

"use client";

import type { ReactNode } from "react";
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
  const { data: meData } = useMe();

  // Determine user role — default to "user" if not yet loaded
  const userRole: UserRole = meData?.role === "admin" ? "admin" : "user";

  // The shell renders unconditionally. Previously this returned bare `children`
  // until a post-mount effect flipped a `mounted` flag, which moved the page
  // subtree to a different position in the tree on the second render — React
  // unmounted and remounted the entire page on every navigation, discarding
  // state and re-running every effect and query.
  //
  // The gate existed to avoid a hydration mismatch on the shell's user-specific
  // text. That is already handled: zustand's `useStore` reads
  // `getInitialState()` during hydration, so the server render and the first
  // client render both see a null session and agree. Middleware redirects
  // unauthenticated users away from protected routes, so a guest never sees
  // the shell.
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
