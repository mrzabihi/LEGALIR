// ============================================================
// LEGALIR — SignatureProvider abstraction (§22)
// ============================================================
// The lifecycle engine never talks to an OTP service directly. It
// talks to a `SignatureProvider`, which answers three questions:
//
//   assuranceLevel()  what legal weight does this method carry?
//   requestChallenge() send the signer a challenge
//   verifyChallenge()  verify it and return the proof
//
// OTP_SIGNATURE is the only provider wired today. A future
// CERTIFICATE_SIGNATURE provider implements the same interface and
// the engine, the routes and the UI need no change — only the
// assurance level (and therefore the wording) changes.
//
// LEGAL NOTE: an OTP signature is «تأیید و امضای الکترونیکی». It must
// NEVER be presented as «امضای الکترونیکی مطمئن» or «امضای دیجیتال
// رسمی» — those require a certificate-backed provider.
// ============================================================

import type { SignatureAssuranceLevel, SignatureProviderId } from "@legalir/types";

/** The outcome of sending a challenge. */
export interface ChallengeIssued {
  sent: boolean;
  /** Masked destination for display, e.g. 0912***0003. */
  destinationMasked: string;
  expiresAt: string;
  /** Attempts remaining before the challenge is destroyed. */
  remainingAttempts: number;
}

/** The outcome of verifying a challenge. */
export interface ChallengeVerified {
  ok: boolean;
  /** Machine-readable failure code when `ok` is false. */
  code?:
    | "NO_CHALLENGE"
    | "EXPIRED"
    | "TOO_MANY_ATTEMPTS"
    | "INVALID_CODE"
    | "RATE_LIMITED";
  /** Persian message for the UI. */
  messageFa?: string;
}

export interface SignatureProvider {
  readonly id: SignatureProviderId;
  /** The legal weight of a signature produced by this provider. */
  assuranceLevel(): SignatureAssuranceLevel;
  /**
   * Send a challenge to the signer. `subject` is a stable key that
   * scopes the challenge (contract + participant), so two signers can
   * never share a challenge.
   */
  requestChallenge(params: { subject: string; mobile: string }): ChallengeIssued;
  /** Verify a challenge code for the same subject. */
  verifyChallenge(params: { subject: string; code: string }): ChallengeVerified;
  /** Drop any outstanding challenge for the subject (after success). */
  clearChallenge(subject: string): void;
}
