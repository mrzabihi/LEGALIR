// ============================================================
// LEGALIR — Review-stamp asset (server-only)
// ============================================================
// The official LEGALIR review stamp is a PRIVATE asset with a single
// master file. It is deliberately NOT stored under `public/`: there is
// no public URL for it, so it can only ever be reached through an
// authorized API route (Super Admin). The original file is never
// modified in place — a change to the stamp is a NEW version with a new
// hash, which in turn voids any approval that was bound to the old one.
//
// The asset is resolved from the module location (not `process.cwd()`),
// so it is found even when the process runs from a temp directory in a
// test. The resolution result carries only integrity metadata to
// callers; the absolute path is never returned to the network layer and
// is never logged.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

/**
 * The identity of the current stamp master. Bump this whenever the
 * master file is replaced so every record self-describes which stamp
 * produced it. A stamp approval is bound to the SHA-256 below.
 */
export const STAMP_ASSET_VERSION = "legalir-review-stamp-1";

/** The master file name — the ONE name the resolver looks for. */
const STAMP_FILE_NAME = "legalir-review-stamp.png";

/** Where the master lives, relative to `apps/frontend`. */
const STAMP_RELATIVE = path.join("assets", "legalir", STAMP_FILE_NAME);

/** Integrity metadata for the stamp master. Never contains a path. */
export interface ReviewStampAsset {
  bytes: Buffer;
  /** SHA-256 (hex) of the exact bytes loaded — the tamper evidence. */
  sha256: string;
  sizeBytes: number;
  /** Human/version label of the master. */
  version: string;
}

/** Public-safe view of the stamp master: no path, no bytes. */
export interface ReviewStampAssetInfo {
  available: boolean;
  version: string;
  sha256: string | null;
  sizeBytes: number | null;
}

/**
 * Candidate locations for the master, most-specific first. The module
 * location is tried first so a test that `chdir`s to a temp dir still
 * finds the bundled asset; the cwd-based candidates cover a standalone
 * build where the source tree is relocated.
 */
function candidatePaths(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/lib/contracts
  const frontendRoot = path.resolve(here, "..", "..", ".."); // .../apps/frontend
  const cwd = process.cwd();
  return [
    path.resolve(frontendRoot, STAMP_RELATIVE),
    path.resolve(cwd, STAMP_RELATIVE),
    path.resolve(cwd, "..", STAMP_RELATIVE),
    path.resolve(cwd, "..", "..", STAMP_RELATIVE),
  ];
}

/** The absolute path of the stamp master, or null when absent. */
function resolveStampAssetPath(): string | null {
  for (const candidate of candidatePaths()) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Unreadable candidate — try the next one.
    }
  }
  return null;
}

/**
 * Load the stamp master with its integrity metadata. Returns null when
 * the asset is absent — the caller then falls back to the legacy text
 * stamp rather than drawing a missing image.
 */
export function loadReviewStamp(): ReviewStampAsset | null {
  const absolute = resolveStampAssetPath();
  if (!absolute) return null;
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    return null;
  }
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return { bytes, sha256, sizeBytes: bytes.length, version: STAMP_ASSET_VERSION };
}

/**
 * Public-safe stamp info for an authorized admin surface. A missing
 * asset reports `available: false` — never an error, never a path.
 */
export function reviewStampInfo(): ReviewStampAssetInfo {
  const asset = loadReviewStamp();
  if (!asset) {
    return { available: false, version: STAMP_ASSET_VERSION, sha256: null, sizeBytes: null };
  }
  return {
    available: true,
    version: asset.version,
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
  };
}

// ------------------------------------------------------------
// The hologram — the print-only companion of the seal
// ------------------------------------------------------------
// `LegalIR_Hologram_PrintOnly (1).html` ships a hologram image whose
// inner text ("Powered By SOYE" + a serial) is deliberately hidden on
// screen and only revealed by `@media print`. The image extracted from
// that file is byte-identical to `legalir-hologram.png` here, so the
// screen preview shows the image WITHOUT the ink and print/PDF shows it
// WITH the ink — the same print-only behaviour, preserved server-side.

export const HOLOGRAM_ASSET_VERSION = "legalir-hologram-1";

/** The ONE hologram file name the resolver looks for. */
const HOLOGRAM_FILE_NAME = "legalir-hologram.png";

const HOLOGRAM_RELATIVE = path.join("assets", "legalir", HOLOGRAM_FILE_NAME);

/**
 * The text printed INSIDE the hologram. It must never render on screen:
 * a digital copy is not a printed hologram, and only the print/PDF
 * output carries the security ink.
 */
export const HOLOGRAM_PRINT_INK = {
  brand: "Powered By SOYE",
  serial: "1361366",
} as const;

/** Same shape as the seal, loaded from the hologram master. */
export function loadHologram(): ReviewStampAsset | null {
  const frontendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    ".."
  );
  const cwd = process.cwd();
  const candidates = [
    path.resolve(frontendRoot, HOLOGRAM_RELATIVE),
    path.resolve(cwd, HOLOGRAM_RELATIVE),
    path.resolve(cwd, "..", HOLOGRAM_RELATIVE),
    path.resolve(cwd, "..", "..", HOLOGRAM_RELATIVE),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
      const bytes = fs.readFileSync(candidate);
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      return { bytes, sha256, sizeBytes: bytes.length, version: HOLOGRAM_ASSET_VERSION };
    } catch {
      // Unreadable candidate — try the next one.
    }
  }
  return null;
}

/** Public-safe hologram metadata. Never a path, never the bytes. */
export function hologramInfo(): ReviewStampAssetInfo {
  const asset = loadHologram();
  if (!asset) {
    return { available: false, version: HOLOGRAM_ASSET_VERSION, sha256: null, sizeBytes: null };
  }
  return {
    available: true,
    version: asset.version,
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
  };
}

// ------------------------------------------------------------
// The public document mark (letterhead logo)
// ------------------------------------------------------------
// Unlike the seal and hologram, this mark is PUBLIC: the same file is
// served at `/legalir-logo.png` and shown in the app's public chrome.
// The PDF draws it so a printed contract carries the same letterhead as
// the A4 sheet — a contract with no mark is not a LEGALIR document.
// A missing file is not an error: the renderer omits the logo and keeps
// the identification block, never substituting another image.

const DOCUMENT_LOGO_RELATIVE = path.join("public", "legalir-logo.png");

/** The raw PNG bytes of the public letterhead mark, or null when absent. */
export function loadDocumentLogo(): Buffer | null {
  const frontendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    ".."
  );
  const cwd = process.cwd();
  const candidates = [
    path.resolve(frontendRoot, DOCUMENT_LOGO_RELATIVE),
    path.resolve(cwd, DOCUMENT_LOGO_RELATIVE),
    path.resolve(cwd, "..", DOCUMENT_LOGO_RELATIVE),
    path.resolve(cwd, "..", "..", DOCUMENT_LOGO_RELATIVE),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
      return fs.readFileSync(candidate);
    } catch {
      // Unreadable candidate — try the next one.
    }
  }
  return null;
}
