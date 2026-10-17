// ============================================================
// LEGALIR — Signature client fingerprint (§9)
// ============================================================
// Every signature event stores a COARSE client fingerprint so the
// audit trail can tell two browsers apart without ever storing an
// identifiable value. Per §9 the raw IP must never be persisted, so
// the fingerprint is a truncated SHA-256 of the user-agent and the
// language preference only — never the address, never a token.
// ============================================================

import crypto from "node:crypto";

/** A short, stable, non-identifying fingerprint for the request's client. */
export function clientFingerprintFrom(request: Request): string {
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  return crypto
    .createHash("sha256")
    .update(`${ua}\u0000${lang}`)
    .digest("hex")
    .slice(0, 16);
}
