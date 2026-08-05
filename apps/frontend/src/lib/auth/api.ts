// ============================================================
// LEGALIR — Auth API Client
// ============================================================
// Thin wrapper over fetch() for auth endpoints.
// OTP codes are never logged or persisted here.
// ============================================================

import type { ApiSuccess, OtpChallenge, OtpResult } from "@legalir/types";

const API_BASE = process.env["NEXT_PUBLIC_API_BASE"] ?? "http://localhost:8000";

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
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
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
