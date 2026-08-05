// ============================================================
// LEGALIR — Theme Persistence Store (Zustand)
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Whether the splash screen has been shown */
  splashShown: boolean;
  setSplashShown: (shown: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === "light" ? "dark" : "light";
          if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-theme", next);
          }
          return { theme: next };
        }),

      splashShown: false,
      setSplashShown: (shown) => set({ splashShown: shown }),
    }),
    {
      name: "legalir-theme",
      partialize: (state) => ({
        theme: state.theme,
        splashShown: state.splashShown,
      }),
    }
  )
);
