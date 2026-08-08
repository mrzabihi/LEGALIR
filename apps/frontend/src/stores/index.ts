// ============================================================
// LEGALIR — Zustand Stores Barrel
// ============================================================

export { useAppShellStore } from "@/lib/stores";
export type { AppShellState } from "@/lib/stores";

export { useThemeStore } from "./theme-store";
export type { Theme } from "./theme-store";

export { useAuthStore } from "./auth-store";
export type { AuthSession, AuthState } from "./auth-store";

export { useAssistantStore } from "./assistant-store";
export type { AssistantMessage, PageContext } from "./assistant-store";
