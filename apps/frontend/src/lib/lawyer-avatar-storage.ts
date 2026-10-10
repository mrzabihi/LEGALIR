// ============================================================
// LEGALIR — Lawyer avatar image storage (server-only)
// ============================================================
// An admin can upload a real portrait from disk; the bytes are persisted
// under `.data/lawyer-avatars/<profileId>.<ext>` (private, git-ignored) and
// served back through `GET /api/v1/lawyers/[id]/avatar`. The stored name is
// derived from the profile id — never the user's file name — so no
// user-supplied path segment ever reaches the filesystem (mirrors
// `document-storage.ts`).
//
// Only raster formats are accepted (PNG/JPEG/WebP). SVG is deliberately
// refused: it can carry script and would be served from our own origin.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Where uploaded portraits live. Private + git-ignored, like the documents root. */
export const AVATAR_ROOT = path.resolve(process.cwd(), ".data", "lawyer-avatars");

/** Hard cap on an uploaded portrait's size. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Accepted upload MIME types → the extension we store the bytes under. */
const EXT_BY_FORMAT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const ALL_EXTENSIONS = Object.values(EXT_BY_FORMAT);

export function isAllowedAvatarFormat(format: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXT_BY_FORMAT, format);
}

/** A profile id reduced to a filesystem-safe token (defence against traversal). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** The public URL that serves a lawyer's stored upload. */
export function lawyerAvatarPath(id: string): string {
  return `/api/v1/lawyers/${encodeURIComponent(id)}/avatar`;
}

/**
 * Does `url` point at THIS lawyer's stored upload? Accepts the versioned form
 * (`…/avatar?v=<hash>`) the save path returns as well as the bare path, so a
 * caller can tell "still the stored portrait" from "an external URL / demo SVG
 * / cleared" without string-matching an exact value.
 */
export function isStoredLawyerAvatar(id: string, url: string | null): boolean {
  if (!url) return false;
  const base = lawyerAvatarPath(id);
  return url === base || url.startsWith(`${base}?`);
}

/**
 * Persist an uploaded portrait and return the URL to store on the profile.
 * Any previously stored file for this id (under a different extension) is
 * removed so exactly one upload exists per lawyer.
 *
 * The returned URL carries a short content hash (`?v=<hash>`) because the
 * served file path is stable per lawyer and replaced in place. Without a
 * version token the URL would be byte-identical after a re-upload, so the
 * browser's cached `Cache-Control: max-age` response (and React's reconciled
 * `<img>` node) would keep showing the OLD portrait even though the row was
 * updated — i.e. "the previous avatar comes back". Hashing the bytes makes a
 * changed portrait a changed URL (fetch fresh) and an unchanged one a no-op.
 */
export function saveLawyerAvatar(id: string, format: string, bytes: Buffer): string {
  const ext = EXT_BY_FORMAT[format];
  if (!ext) throw new Error("unsupported avatar format");

  const token = safeId(id);
  fs.mkdirSync(AVATAR_ROOT, { recursive: true });

  for (const other of ALL_EXTENSIONS) {
    if (other === ext) continue;
    try {
      fs.unlinkSync(path.join(AVATAR_ROOT, `${token}.${other}`));
    } catch {
      // No prior file under this extension — nothing to remove.
    }
  }

  const target = path.resolve(AVATAR_ROOT, `${token}.${ext}`);
  // Containment check — mirrors resolveLawyerAvatar's guarantee.
  if (!target.startsWith(AVATAR_ROOT + path.sep)) throw new Error("invalid avatar path");
  fs.writeFileSync(target, bytes);

  const version = createHash("sha1").update(bytes).digest("hex").slice(0, 10);
  return `${lawyerAvatarPath(id)}?v=${version}`;
}

/** Resolve a stored portrait for a profile id, or null when none exists. */
export function resolveLawyerAvatar(
  id: string
): { absolutePath: string; contentType: string } | null {
  const token = safeId(id);
  for (const ext of ALL_EXTENSIONS) {
    const candidate = path.resolve(AVATAR_ROOT, `${token}.${ext}`);
    if (!candidate.startsWith(AVATAR_ROOT + path.sep)) continue;
    if (!fs.existsSync(candidate)) continue;
    if (!fs.statSync(candidate).isFile()) continue;
    return {
      absolutePath: candidate,
      contentType: CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
    };
  }
  return null;
}

/** Delete a stored portrait (best-effort — a missing file is not an error). */
export function deleteLawyerAvatar(id: string): void {
  const token = safeId(id);
  for (const ext of ALL_EXTENSIONS) {
    try {
      fs.unlinkSync(path.join(AVATAR_ROOT, `${token}.${ext}`));
    } catch {
      // Already gone.
    }
  }
}
