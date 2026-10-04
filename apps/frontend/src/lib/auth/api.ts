// ============================================================
// LEGALIR — Auth API Client
// ============================================================
// Thin wrapper over fetch() for auth endpoints.
// OTP codes are never logged or persisted here.
// ============================================================

import type { ApiSuccess, OtpChallenge, OtpResult, RegistrationIntent } from "@legalir/types";
import {
  normalizeIranMobile,
  toNationalMobile,
  toPersianMobileDisplay,
  maskMobile,
  MOBILE_ERROR_MESSAGE,
} from "@legalir/validation";

export { toNationalMobile, toPersianMobileDisplay, maskMobile, MOBILE_ERROR_MESSAGE };

// OTP endpoints are handled by MSW (mocked external backend)
const API_BASE = process.env["NEXT_PUBLIC_API_BASE"] ?? "";

// Password-based auth endpoints use Next.js API routes (real SQLite-backed routes)
// These are relative URLs served from the same origin, bypassing MSW.
const NEXT_API = "";

// ============================================================
// OTP-based auth (existing)
// ============================================================

export async function requestOtpApi(mobile: string): Promise<ApiSuccess<OtpChallenge>> {
  const res = await fetch(`${API_BASE}/api/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mobile }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export async function verifyOtpApi(
  challengeId: string,
  code: string
): Promise<ApiSuccess<OtpResult>> {
  const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ challengeId, code }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export async function logoutApi(): Promise<void> {
  await fetch(`${NEXT_API}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}

// ============================================================
// Current user (session-based)
// ============================================================

export interface GetMeResult {
  user: {
    id: string;
    mobileE164: string;
    mobileDisplay: string;
    status: string;
  };
  profile: {
    displayName: string | null;
    mobile: string;
    email: string | null;
  };
}

export async function getMeApi(): Promise<ApiSuccess<GetMeResult>> {
  const res = await fetch(`${NEXT_API}/api/auth/me`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

/**
 * Normalize an Iranian mobile number to canonical E.164 (`+989123456789`).
 *
 * Delegates to the shared `@legalir/validation` module so the web app,
 * the API routes and the JSON store all agree on one identity. Accepts
 * Persian/Arabic digits, spaces, dashes, parentheses and the +98 / 0098
 * / 98 / 0 prefixes. Returns null when the input is not a valid Iranian
 * mobile number.
 */
export function normalizeMobile(raw: string): string | null {
  return normalizeIranMobile(raw);
}

/**
 * Convert any accepted mobile format to E.164 (`+989123456789`).
 * Idempotent: a canonical value passes through unchanged.
 */
export function toE164(mobile: string): string {
  return normalizeIranMobile(mobile) ?? mobile;
}

// ============================================================
// Password-based auth (new)
// ============================================================

export interface RegisterPayload {
  mobile: string;
  password: string;
  email?: string;
  acceptTerms: boolean;
  /**
   * The registration track the user chose in step 1. Untrusted client
   * input — the server normalizes it against an allow-list and falls back
   * to PERSONAL. It only seeds onboarding; it never grants a role.
   */
  registrationIntent?: RegistrationIntent;
}

export interface RegisterResult {
  sessionId: string;
  user: {
    id: string;
    mobileE164: string;
    mobileDisplay: string;
    status: string;
  };
  isNewUser: boolean;
}

export async function registerApi(payload: RegisterPayload): Promise<ApiSuccess<RegisterResult>> {
  const res = await fetch(`${NEXT_API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export interface PasswordLoginPayload {
  mobile: string;
  password: string;
}

export interface PasswordLoginResult {
  sessionId: string;
  user: {
    id: string;
    mobileE164: string;
    mobileDisplay: string;
    status: string;
  };
  isNewUser: boolean;
}

export async function passwordLoginApi(payload: PasswordLoginPayload): Promise<ApiSuccess<PasswordLoginResult>> {
  const res = await fetch(`${NEXT_API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export interface ForgotPasswordRequestResult {
  status: "otp_sent";
  challengeId: string;
  expiresAt: string;
  mobile: string;
}

export async function forgotPasswordRequestApi(mobile: string): Promise<ApiSuccess<ForgotPasswordRequestResult>> {
  const res = await fetch(`${API_BASE}/api/auth/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mobile }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export interface ForgotPasswordVerifyPayload {
  challengeId: string;
  code: string;
}

export interface ForgotPasswordVerifyResult {
  status: "verified";
  resetToken: string;
}

export async function forgotPasswordVerifyApi(
  payload: ForgotPasswordVerifyPayload
): Promise<ApiSuccess<ForgotPasswordVerifyResult>> {
  const res = await fetch(`${API_BASE}/api/auth/password/forgot/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}

export interface ResetPasswordPayload {
  resetToken: string;
  password: string;
}

export interface ResetPasswordResult {
  status: "password_reset";
}

export async function resetPasswordApi(payload: ResetPasswordPayload): Promise<ApiSuccess<ResetPasswordResult>> {
  const res = await fetch(`${API_BASE}/api/auth/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw body ?? { code: "NETWORK_ERROR", message: "خطا در ارتباط با سرور", retryable: true };
  }

  return res.json();
}
