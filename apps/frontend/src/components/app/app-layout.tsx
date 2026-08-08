// ============================================================
// LEGALIR — Authenticated App Layout
// Combines AppShell with Sidebar, TopBar, BottomNav
// ============================================================

"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import { AppShell } from "@/lib/layout-primitives";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import type { UserRole } from "@/lib/routes";
import { OfflineBanner } from "@/components/shared";
import { AiAssistant } from "@/components/assistant";
import type { PageContext } from "@/stores/assistant-store";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: meData } = useMe();

  // Determine user role — default to "user" if not yet loaded
  const userRole: UserRole = meData?.role === "admin" ? "admin" : "user";

  // Derive page context from pathname for the AI Assistant
  const pathname = usePathname();
  const pageContext = useMemo<string | undefined>(() => {
    // Strip leading slash and get the first path segment
    const segments = pathname.replace(/^\//, "").split("/");
    const primary = segments[0] ?? "";
    // Map route segments to valid PageContext values
    const validContexts: PageContext[] = [
      "dashboard",
      "chat",
      "contracts",
      "documents",
      "settings",
      "history",
      "new",
      "subscription",
      "profile",
      "memory",
    ];
    if (validContexts.includes(primary as PageContext)) {
      return primary;
    }
    return undefined;
  }, [pathname]);

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
      {/* Global AI Assistant — accessible from all dashboard pages */}
      <AiAssistant pageContext={pageContext} />
    </>
  );
}
