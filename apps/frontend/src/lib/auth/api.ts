// ============================================================
// LEGALIR — Auth API Client
// ============================================================
// Thin wrapper over fetch() for auth endpoints.
// OTP codes are never logged or persisted here.
// ============================================================

import type { ApiSuccess, OtpChallenge, OtpResult } from "@legalir/types";

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
 * Normalize Iranian mobile numbers:
 * - Converts Persian digits to Western
 * - Strips whitespace, dashes, parentheses
 * - Handles +98, 0098, and 0 prefixes
 * - Returns 09XXXXXXXXX format or null if invalid
 */
export function normalizeMobile(raw: string): string | null {
  // Convert Persian/Arabic digits to Western
  const persianMap: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };

  let cleaned = raw
    .replace(/[۰-۹٠-٩]/g, (d) => persianMap[d] ?? d)
    .replace(/[\s\-().]/g, "");

  // Strip +98 / 0098 prefix
  if (cleaned.startsWith("+98")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("0098")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("98") && cleaned.length === 12) {
    cleaned = "0" + cleaned.slice(2);
  }

  // Validate: must be 0 followed by 9 and 9 more digits
  if (!/^09\d{9}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Convert 09XXXXXXXXX to E.164 format (+989XXXXXXXXX)
 */
export function toE164(mobile: string): string {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return mobile;
  return "+98" + normalized.slice(1);
}

// ============================================================
// Password-based auth (new)
// ============================================================

export interface RegisterPayload {
  mobile: string;
  password: string;
  email?: string;
  acceptTerms: boolean;
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
