// ============================================================
// LEGALIR — Idempotency Key Support
// ============================================================
// Generates and attaches Idempotency-Key headers to POST/PATCH
// requests that create or mutate resources, preventing duplicate
// operations on network retries.
//
// Backend requirement: store (key, response) pairs for ≥24h.
// Frontend: generate UUID v4 per mutation attempt, reuse on retry.
// ============================================================

let _crypto: Crypto | undefined;
function getCrypto(): Crypto {
  if (!_crypto) {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      _crypto = globalThis.crypto;
    } else {
      // Fallback for environments without crypto (should not happen in modern browsers)
      throw new Error("Crypto API not available — idempotency keys require crypto.randomUUID()");
    }
  }
  return _crypto;
}

/** Generate a fresh idempotency key. Call once per logical mutation attempt. */
export function generateIdempotencyKey(): string {
  return getCrypto().randomUUID();
}

// --- Operations requiring idempotency keys ---

/**
 * These endpoint patterns are classified as "create" operations
 * that MUST include an Idempotency-Key header.
 */
const IDEMPOTENT_CREATE_PATTERNS = [
  "/api/v1/checkout/intents",
  "/api/v1/conversations",
  "/api/v1/conversations/", // .../messages, .../ai-runs
  "/api/v1/documents/uploads",
  "/api/v1/documents/", // .../retry
  "/api/v1/contracts",
  "/api/v1/contracts/drafts",
  "/api/v1/ai-runs",
  "/api/auth/otp/request",
  "/api/auth/otp/verify",
] as const;

/**
 * Determine whether a POST/PATCH to the given path should include
 * an Idempotency-Key header.
 */
export function requiresIdempotencyKey(method: string, path: string): boolean {
  if (method !== "POST" && method !== "PATCH") return false;
  // DELETE is inherently idempotent; GET is safe
  return IDEMPOTENT_CREATE_PATTERNS.some((pattern) => path.startsWith(pattern));
}

/** Header name sent to the backend. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
