// ============================================================
// LEGALIR — OTP Provider Adapter Contract
// ============================================================
// Abstract contract for OTP delivery providers.
// Development: static OTP (405405) via MSW handler.
// Production:  Kavenegar SMS gateway adapter.
// ============================================================

import type { OtpChallenge } from "@legalir/types";

/**
 * Output contract returned to the UI after requesting an OTP.
 * Never contains the OTP code itself.
 */
export interface OtpRequestResult {
  challengeId: string;
  expiresAt: string;
  remainingAttempts: number;
  resendCooldownSeconds: number;
}

/**
 * Output contract returned to the UI after verifying an OTP.
 */
export interface OtpVerifyResult {
  sessionId: string;
  isNewUser: boolean;
  userId: string;
  mobileE164: string;
  mobileDisplay: string;
}

/**
 * Error codes that the UI handles explicitly.
 * Maps to MSW error scenarios + future Kavenegar failures.
 */
export type OtpErrorCode =
  | "INVALID_MOBILE"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_REUSED"
  | "RATE_LIMITED"
  | "TOO_MANY_ATTEMPTS"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR";

/**
 * Structured OTP error for UI consumption.
 */
export interface OtpError {
  code: OtpErrorCode;
  message: string;
  retryable: boolean;
  /** If the UI should show a resend button */
  allowResend: boolean;
  /** Seconds until next allowed retry (for rate-limit scenarios) */
  retryAfterSeconds?: number;
}

/**
 * Abstract OTP provider interface.
 *
 * Each provider receives a normalized mobile number (09XXXXXXXXX format)
 * and returns typed results. The UI never sees the actual OTP code.
 */
export interface OtpProvider {
  /** Display name for logging/debugging (never shown to user) */
  readonly name: string;

  /** Request a one-time password be sent to the given mobile number */
  requestOtp(mobile: string): Promise<OtpRequestResult>;

  /** Verify the OTP code against the challenge */
  verifyOtp(challengeId: string, code: string): Promise<OtpVerifyResult>;
}

/**
 * Maps the raw API OtpChallenge to our UI contract.
 * Strips sensitive/internal fields.
 */
export function mapChallengeToResult(c: OtpChallenge): OtpRequestResult {
  return {
    challengeId: c.challengeId,
    expiresAt: c.expiresAt,
    remainingAttempts: c.remainingAttempts,
    resendCooldownSeconds: c.resendCooldownSeconds,
  };
}
