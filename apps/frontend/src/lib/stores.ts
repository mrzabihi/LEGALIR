// ============================================================
// LEGALIR — Zustand Store Conventions
// ============================================================
// Conventions:
//  - Slice files in src/stores/ directory
//  - Actions prefixed with a verb (set, toggle, reset, push, remove)
//  - DevTools middleware enabled in development
//  - Persist middleware for theme/locale preferences
//  - No server state — React Query owns the server cache
// ============================================================

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// --- App Shell Store ---

export interface AppShellState {
  /** Mobile drawer open */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  /** Active route path */
  activePath: string;
  setActivePath: (path: string) => void;

  /** Global notification (non-persistent, cleared on navigate) */
  notification: { type: "info" | "success" | "warning" | "error"; message: string } | null;
  setNotification: (n: AppShellState["notification"]) => void;
  clearNotification: () => void;
}

export const useAppShellStore = create<AppShellState>()(
  devtools(
    (set) => ({
      drawerOpen: false,
      setDrawerOpen: (open) => set({ drawerOpen: open }, false, "setDrawerOpen"),
      toggleDrawer: () =>
        set((s) => ({ drawerOpen: !s.drawerOpen }), false, "toggleDrawer"),

      activePath: "/dashboard",
      setActivePath: (path) => set({ activePath: path }, false, "setActivePath"),

      notification: null,
      setNotification: (n) => set({ notification: n }, false, "setNotification"),
      clearNotification: () => set({ notification: null }, false, "clearNotification"),
    }),
    { name: "app-shell", enabled: process.env.NODE_ENV === "development" }
  )
);
