// ============================================================
// LEGALIR — Authentication Store (Zustand + persist)
// ============================================================
// Manages: session, user summary, isNewUser flag.
// Persisted to localStorage so session survives refresh.
// OTP codes are NEVER stored here.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthSession {
  sessionId: string;
  userId: string;
  mobileE164: string;
  mobileDisplay: string;
  isNewUser: boolean;
  createdAt: number; // Date.now() when session was created
}

export interface AuthState {
  /** Current session, or null if not authenticated */
  session: AuthSession | null;

  /** Whether an auth operation is in progress */
  isLoading: boolean;

  /** The intended route to redirect to after login (e.g. /chat?intent=chat) */
  intendedRoute: string | null;

  // --- Actions ---

  /** Set the session after successful OTP verification */
  setSession: (session: AuthSession) => void;

  /** Clear the session (logout) */
  clearSession: () => void;

  /** Set the loading state */
  setLoading: (loading: boolean) => void;

  /** Set the intended route for post-login redirect */
  setIntendedRoute: (route: string | null) => void;

  /** Whether the user is authenticated */
  isAuthenticated: () => boolean;

  /** Whether the user needs to complete their profile */
  isNewUser: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      intendedRoute: null,

      setSession: (session) =>
        set({
          session: { ...session, createdAt: Date.now() },
          isLoading: false,
        }),

      clearSession: () =>
        set({
          session: null,
          isLoading: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setIntendedRoute: (route) => set({ intendedRoute: route }),

      isAuthenticated: () => {
        const { session } = get();
        return session !== null && session.sessionId.length > 0;
      },

      isNewUser: () => {
        const { session } = get();
        return session?.isNewUser ?? false;
      },
    }),
    {
      name: "legalir-auth",
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);
