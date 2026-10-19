// ============================================================
// LEGALIR — Judicial final-document storage (server-only)
// ============================================================
// Issued judicial artifacts are PRIVATE. They are written under
// `.data/judicial-documents/<requestId>/<finalDocId>.pdf` and served only
// through an authorized route — the owner's, or an operator holding
// `admin:judicial:read`. No public URL is ever produced, so a leaked key
// cannot be fetched without a session that may read that request.
//
// Every resolved path is verified to stay inside the request's own
// directory, so a crafted key can never escape the root.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd(), ".data", "judicial-documents");

/** Reject ids that could traverse out of the storage root. */
function isSafeSegment(segment: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(segment);
}

export interface StoredJudicialFile {
  /** Relative storage key, e.g. "req-abc/final-xyz.pdf". */
  storageKey: string;
  absolutePath: string;
  sizeBytes: number;
  /** SHA-256 of the bytes, hex. */
  hash: string;
}

/** Persist the final PDF bytes for one request. */
export function writeJudicialFile(params: {
  requestId: string;
  documentId: string;
  bytes: Uint8Array;
}): StoredJudicialFile {
  const { requestId, documentId, bytes } = params;
  if (!isSafeSegment(requestId) || !isSafeSegment(documentId)) {
    throw new Error("Unsafe storage segment");
  }

  const dir = path.join(ROOT, requestId);
  fs.mkdirSync(dir, { recursive: true });

  const storedName = `${documentId}.pdf`;
  const absolutePath = path.join(dir, storedName);
  if (!absolutePath.startsWith(dir + path.sep)) {
    throw new Error("Path traversal detected");
  }

  fs.writeFileSync(absolutePath, bytes);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");

  return {
    storageKey: `${requestId}/${storedName}`,
    absolutePath,
    sizeBytes: bytes.byteLength,
    hash,
  };
}

/** Resolve a storage key to an absolute path inside the root, or null. */
export function resolveJudicialFile(storageKey: string | null): string | null {
  if (!storageKey) return null;
  if (storageKey.includes("..") || storageKey.includes("\0")) return null;

  const parts = storageKey.replace(/\\/g, "/").split("/");
  if (parts.length !== 2) return null;
  const [requestId, storedName] = parts as [string, string];
  if (!isSafeSegment(requestId)) return null;
  if (!/^[A-Za-z0-9_-]{1,64}\.pdf$/.test(storedName)) return null;

  const candidate = path.resolve(ROOT, requestId, storedName);
  if (!candidate.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(candidate)) return null;
  if (!fs.statSync(candidate).isFile()) return null;
  return candidate;
}

/** SHA-256 of arbitrary bytes, hex. */
export function hashBytes(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}
