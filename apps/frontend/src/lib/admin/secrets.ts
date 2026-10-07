// ============================================================
// LEGALIR — Admin secret storage (server-only)
// ============================================================
// Provider API keys are encrypted at rest with AES-256-GCM. The key is
// derived from `LEGALIR_ADMIN_SECRET_KEY`. When that env var is absent we
// DO NOT fall back to plaintext: the caller treats the secret as
// "unconfigured" instead. Raw secrets are never returned by any admin API
// — only a masked hint (last 4 chars) is ever exposed.
// ============================================================

import crypto from "node:crypto";

const ENV_KEY = "LEGALIR_ADMIN_SECRET_KEY";

export interface EncryptedSecret {
  /** Base64 of iv.tag.ciphertext — opaque, safe to persist. */
  ciphertext: string;
  /** Masked hint, e.g. "••••ab12". Never reversible to the full key. */
  hint: string;
  /** Algorithm marker for future rotation. */
  alg: "aes-256-gcm";
}

function encryptionKey(): Buffer | null {
  const raw = process.env[ENV_KEY];
  if (!raw || raw.trim().length < 16) return null;
  // Derive a stable 32-byte key from the configured passphrase.
  return crypto.createHash("sha256").update(raw).digest();
}

/** True when a secret-storage key is configured. */
export function isSecretStorageConfigured(): boolean {
  return encryptionKey() !== null;
}

/** A masked hint of a secret — the last 4 visible characters only. */
export function maskSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return "••••";
  return "••••" + trimmed.slice(-4);
}

/**
 * Encrypt a raw secret. Returns null when no storage key is configured —
 * the caller must then surface the "unconfigured" state rather than persist
 * the secret in the clear.
 */
export function encryptSecret(raw: string): EncryptedSecret | null {
  const key = encryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, tag, enc]).toString("base64");
  return { ciphertext, hint: maskSecret(raw), alg: "aes-256-gcm" };
}

/** Decrypt a stored secret; null when invalid or storage is unconfigured. */
export function decryptSecret(stored: EncryptedSecret): string | null {
  const key = encryptionKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(stored.ciphertext, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
