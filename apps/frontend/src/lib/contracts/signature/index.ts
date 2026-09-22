// ============================================================
// LEGALIR — Signature layer entry point
// ============================================================
// One place to resolve the active SignatureProvider and to turn an
// assurance level into the wording the UI is allowed to show.
//
// The engine, the routes and the UI all import from here — never from
// a concrete provider — so swapping OTP for a certificate-backed
// provider is a one-line change in `activeSignatureProvider`.
// ============================================================

import {
  SIGNATURE_ASSURANCE_LABELS_FA,
  type SignatureAssuranceLevel,
  type SignatureProviderId,
} from "@legalir/types";
import { otpSignatureProvider } from "./otp-provider";
import type { SignatureProvider } from "./provider";

export type {
  ChallengeIssued,
  ChallengeVerified,
  SignatureProvider,
} from "./provider";
export { otpSignatureProvider } from "./otp-provider";
export { verifyVersionIntegrity, type IntegrityResult } from "./integrity";

/**
 * The provider that signs contracts right now. A future
 * CERTIFICATE_SIGNATURE provider is selected here; nothing downstream
 * changes except the assurance level (and therefore the wording).
 */
export function activeSignatureProvider(): SignatureProvider {
  return otpSignatureProvider;
}

/** The provider for a given id, or the active one when unknown. */
export function signatureProviderFor(id: SignatureProviderId): SignatureProvider {
  switch (id) {
    case "OTP_SIGNATURE":
      return otpSignatureProvider;
    default:
      return activeSignatureProvider();
  }
}

/**
 * The Persian wording for an assurance level. This is the ONLY place
 * the UI should get signature wording from — an OTP signature is
 * «تأیید و امضای الکترونیکی», never «امضای الکترونیکی مطمئن».
 */
export function signatureAssuranceLabelFa(level: SignatureAssuranceLevel): string {
  return SIGNATURE_ASSURANCE_LABELS_FA[level];
}
