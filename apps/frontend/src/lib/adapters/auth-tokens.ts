// ============================================================
// LEGALIR — Auth Token Management Adapter Contract
// ============================================================
// Defines the token handling strategy without hard-coding
// a final production approach.
//
// Current strategy: cookie-based sessions (HttpOnly cookies
// set by the backend on OTP verify, cleared on logout).
// The frontend never sees or stores the session token.
//
// Alternative strategies supported by this contract:
//  - Bearer token in Authorization header
//  - Access + Refresh token rotation
//  - JWT with localStorage (NOT recommended for production)
//
// The adapter is a boundary: frontend code depends on
// AuthTokenManager, not on any specific token implementation.
// ============================================================

/** The minimal auth state the frontend cares about. */
export interface TokenStore {
  /** Whether the user currently has a valid session. */
  isAuthenticated: boolean;
  /** The user ID (if authenticated). */
  userId: string | null;
  /** The session expiry timestamp (ISO), if known. */
  sessionExpiresAt: string | null;
}

/**
 * Abstract authentication token manager.
 *
 * Responsibilities:
 *  - Read current auth state
 *  - Handle session expiry (refresh or redirect)
 *  - Provide auth headers for API requests (if using bearer tokens)
 *  - Coordinate with the auth store (Zustand) for UI state
 *
 * Note: With the current cookie-based approach, this adapter
 * primarily reads state — the actual token is managed by the
 * browser's cookie jar and never exposed to JavaScript.
 */
export interface AuthTokenManager {
  /** Get the current authentication state. */
  getTokenStore(): TokenStore;

  /** Attempt to refresh the session (e.g., via refresh token). */
  refreshSession(): Promise<boolean>;

  /** Clear all auth state (local logout). */
  clearSession(): void;

  /**
   * Called by apiClient when a 401 response is received.
   * Implementations should decide: refresh token, redirect to login,
   * or simply notify the user.
   */
  handleUnauthorized(): Promise<void>;
}
