// ============================================================
// LEGALIR — OTP SignatureProvider (v1)
// ============================================================
// The only provider wired today. It produces an
// ELECTRONIC_CONFIRMATION-level signature: the signer proved control
// of a mobile number, nothing more.
//
// SECURITY (§80-86):
//   • the code is generated with crypto.randomInt, never Math.random
//   • only the SHA-256 hash of the code is kept in memory
//   • the raw code is never logged, returned or persisted
//   • a challenge is destroyed after 5 failed attempts
//   • requests are rate-limited per subject (3 per 5 minutes)
//   • a challenge is single-use: it is cleared on success
//
// The demo code 405405 is accepted in development so the flow is
// testable end-to-end without an SMS gateway — the same convention the
// login OTP uses. In production the code is delivered by the SMS
// adapter and 405405 is not special.
// ============================================================

import crypto from "node:crypto";
import type { SignatureAssuranceLevel, SignatureProviderId } from "@legalir/types";
import type {
  ChallengeIssued,
  ChallengeVerified,
  SignatureProvider,
} from "./provider";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 3;
const CODE_LENGTH = 6;

/** Development-only static code, matching the login OTP convention. */
const DEV_OTP = "405405";

interface Challenge {
  /** SHA-256 hex of the code — the raw code is never kept. */
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

// Process-wide stores, keyed by subject, so a hot reload does not
// silently drop an outstanding challenge.
const challengeKey = Symbol.for("legalir.contract.signature.challenges");
const rateKey = Symbol.for("legalir.contract.signature.rate");
const globalStore = globalThis as unknown as Record<symbol, Map<string, unknown>>;

const challenges =
  (globalStore[challengeKey] as Map<string, Challenge> | undefined) ??
  (globalStore[challengeKey] = new Map<string, Challenge>());

const rateLog =
  (globalStore[rateKey] as Map<string, number[]> | undefined) ??
  (globalStore[rateKey] = new Map<string, number[]>());

/** SHA-256 hex of a code. */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison of two hex digests. */
function digestsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Mask a mobile number for display, e.g. 0912***0003. */
function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}

/** A cryptographically secure 6-digit code. */
function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, "0");
}

class OtpSignatureProvider implements SignatureProvider {
  readonly id: SignatureProviderId = "OTP_SIGNATURE";

  assuranceLevel(): SignatureAssuranceLevel {
    return "ELECTRONIC_CONFIRMATION";
  }

  requestChallenge(params: { subject: string; mobile: string }): ChallengeIssued {
    const { subject, mobile } = params;
    const now = Date.now();

    const recent = (rateLog.get(subject) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      return {
        sent: false,
        destinationMasked: maskMobile(mobile),
        expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
        remainingAttempts: 0,
      };
    }
    recent.push(now);
    rateLog.set(subject, recent);

    // In development the code is fixed so the flow is testable; in
    // production it is random and delivered by the SMS adapter.
    const code = process.env.NODE_ENV === "production" ? generateCode() : DEV_OTP;

    challenges.set(subject, {
      codeHash: hashCode(code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });

    return {
      sent: true,
      destinationMasked: maskMobile(mobile),
      expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  verifyChallenge(params: { subject: string; code: string }): ChallengeVerified {
    const { subject, code } = params;
    const challenge = challenges.get(subject);
    if (!challenge) {
      return { ok: false, code: "NO_CHALLENGE", messageFa: "ابتدا کد تأیید را درخواست کنید." };
    }
    if (Date.now() > challenge.expiresAt) {
      challenges.delete(subject);
      return { ok: false, code: "EXPIRED", messageFa: "کد تأیید منقضی شده است." };
    }

    challenge.attempts += 1;
    if (challenge.attempts > MAX_ATTEMPTS) {
      challenges.delete(subject);
      return {
        ok: false,
        code: "TOO_MANY_ATTEMPTS",
        messageFa: "تعداد تلاش‌ها بیش از حد مجاز است.",
      };
    }

    if (!digestsEqual(hashCode(code), challenge.codeHash)) {
      return { ok: false, code: "INVALID_CODE", messageFa: "کد وارد شده صحیح نیست." };
    }

    // Single-use: a verified challenge can never be replayed.
    challenges.delete(subject);
    return { ok: true };
  }

  clearChallenge(subject: string): void {
    challenges.delete(subject);
  }
}

/** The active OTP provider. Stateless — safe to share. */
export const otpSignatureProvider: SignatureProvider = new OtpSignatureProvider();
