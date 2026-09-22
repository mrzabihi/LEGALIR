// ============================================================
// LEGALIR — Document file storage resolution (server-only)
// ============================================================
// Resolves a document's stored bytes to an absolute path on disk.
// Two roots are supported, in priority order:
//
//   1. .data/demo-documents/   — private, git-ignored (real uploads)
//   2. public/demo-documents/  — committed demo fixtures
//
// The private root wins so a real upload can shadow a demo fixture
// without touching tracked files. Every resolved path is verified to
// stay inside its root, so a crafted `previewUrl`/`storageKey` can
// never escape the storage directory (path traversal).
// ============================================================

import fs from "node:fs";
import path from "node:path";

const PRIVATE_ROOT = path.resolve(process.cwd(), ".data", "demo-documents");
const PUBLIC_ROOT = path.resolve(process.cwd(), "public", "demo-documents");

export interface ResolvedDocumentFile {
  absolutePath: string;
  fileName: string;
  sizeBytes: number;
}

/**
 * Normalise a stored reference to a bare file name. Accepts either a
 * `storageKey` ("demo-documents/x.pdf") or a `previewUrl`
 * ("/demo-documents/x.pdf") and strips any directory prefix.
 */
function toFileName(reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed) return null;
  // Reject anything that tries to walk up or use a null byte.
  if (trimmed.includes("..") || trimmed.includes("\0")) return null;
  const base = path.basename(trimmed.replace(/\\/g, "/"));
  if (!base || base === "." || base === "..") return null;
  return base;
}

/**
 * Resolve a stored file reference to an absolute path inside one of the
 * storage roots. Returns null when the reference is unsafe or the file
 * does not exist.
 */
export function resolveDocumentFile(reference: string | null): ResolvedDocumentFile | null {
  if (!reference) return null;
  const fileName = toFileName(reference);
  if (!fileName) return null;

  for (const root of [PRIVATE_ROOT, PUBLIC_ROOT]) {
    const candidate = path.resolve(root, fileName);
    // Containment check — the resolved path must stay under its root.
    if (candidate !== path.join(root, fileName)) continue;
    if (!candidate.startsWith(root + path.sep)) continue;
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) continue;
    return { absolutePath: candidate, fileName, sizeBytes: stat.size };
  }

  return null;
}

/** The stored reference for a document: prefer storageKey, fall back to previewUrl. */
export function documentFileReference(doc: {
  storageKey: string | null;
  previewUrl: string | null;
}): string | null {
  return doc.storageKey ?? doc.previewUrl ?? null;
}

/**
 * Persist uploaded bytes into the private root and return the
 * `storageKey` to record on the document row.
 *
 * The stored name is derived from the document id (not the user's file
 * name), so two uploads of "قرارداد.pdf" can never collide and no
 * user-supplied path segment ever reaches the filesystem. The original
 * name is preserved on the document row and used for the download
 * filename instead.
 */
export function saveDocumentFile(
  documentId: string,
  fileName: string,
  bytes: Buffer
): string {
  const safeId = documentId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  const storedName = `${safeId}${ext}`;

  fs.mkdirSync(PRIVATE_ROOT, { recursive: true });
  const target = path.resolve(PRIVATE_ROOT, storedName);
  // Containment check — mirrors resolveDocumentFile's guarantee.
  if (!target.startsWith(PRIVATE_ROOT + path.sep)) {
    throw new Error("invalid storage path");
  }
  fs.writeFileSync(target, bytes);
  return `demo-documents/${storedName}`;
}

/**
 * Delete a document's stored bytes. Best-effort: a missing file is not
 * an error, so deleting a row whose bytes were never written (or were
 * already removed) still succeeds.
 *
 * Only the private root is touched — committed demo fixtures under
 * `public/demo-documents/` are tracked files and must never be removed
 * by a user action.
 */
export function deleteDocumentFile(reference: string | null): void {
  if (!reference) return;
  const fileName = toFileName(reference);
  if (!fileName) return;

  const target = path.resolve(PRIVATE_ROOT, fileName);
  // Containment check — mirrors saveDocumentFile's guarantee.
  if (!target.startsWith(PRIVATE_ROOT + path.sep)) return;
  try {
    fs.unlinkSync(target);
  } catch {
    // Already gone — nothing to do.
  }
}
