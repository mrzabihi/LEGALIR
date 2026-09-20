// ============================================================
// LEGALIR — Contract document storage (server-only)
// ============================================================
// Contract documents are private: they are written under
// `.data/contract-documents/<contractId>/<documentId>.<ext>` and are
// only ever served through an authorized API route. No public URL is
// ever produced, so a leaked path cannot be fetched without a session
// that owns the contract.
//
// Every resolved path is verified to stay inside the contract's own
// directory, so a crafted document id can never escape the root.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd(), ".data", "contract-documents");

/** A safe file extension derived from the original name (never trusted raw). */
function safeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return ".bin";
  return ext;
}

/** Reject ids that could traverse out of the storage root. */
function isSafeSegment(segment: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(segment);
}

export interface StoredContractFile {
  /** Relative storage key, e.g. "cnt-abc/doc-xyz.pdf". */
  storageKey: string;
  absolutePath: string;
  sizeBytes: number;
  /** SHA-256 of the bytes, hex. */
  hash: string;
}

/**
 * Persist bytes for a contract document. Returns the storage key and
 * the content hash. Throws when the ids are unsafe.
 */
export function writeContractFile(params: {
  contractId: string;
  documentId: string;
  fileName: string;
  bytes: Buffer;
}): StoredContractFile {
  const { contractId, documentId, fileName, bytes } = params;
  if (!isSafeSegment(contractId) || !isSafeSegment(documentId)) {
    throw new Error("Unsafe storage segment");
  }

  const dir = path.join(ROOT, contractId);
  fs.mkdirSync(dir, { recursive: true });

  const storedName = `${documentId}${safeExtension(fileName)}`;
  const absolutePath = path.join(dir, storedName);

  // Containment check — the resolved path must stay under the contract dir.
  if (!absolutePath.startsWith(dir + path.sep)) {
    throw new Error("Path traversal detected");
  }

  fs.writeFileSync(absolutePath, bytes);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");

  return {
    storageKey: `${contractId}/${storedName}`,
    absolutePath,
    sizeBytes: bytes.length,
    hash,
  };
}

/**
 * Resolve a storage key to an absolute path inside the storage root.
 * Returns null when the key is unsafe or the file is missing.
 */
export function resolveContractFile(storageKey: string | null): string | null {
  if (!storageKey) return null;
  if (storageKey.includes("..") || storageKey.includes("\0")) return null;

  const normalized = storageKey.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (parts.length !== 2) return null;
  const [contractId, storedName] = parts as [string, string];
  if (!isSafeSegment(contractId)) return null;
  if (!/^[A-Za-z0-9_-]{1,64}\.[a-z0-9]{1,8}$/.test(storedName)) return null;

  const candidate = path.resolve(ROOT, contractId, storedName);
  if (!candidate.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(candidate)) return null;
  const stat = fs.statSync(candidate);
  if (!stat.isFile()) return null;
  return candidate;
}

/** Delete a stored file. Best-effort — missing files are not an error. */
export function deleteContractFile(storageKey: string | null): void {
  const absolute = resolveContractFile(storageKey);
  if (!absolute) return;
  try {
    fs.unlinkSync(absolute);
  } catch {
    // Already gone — nothing to do.
  }
}

/** SHA-256 of an arbitrary buffer, hex. */
export function hashBytes(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}
