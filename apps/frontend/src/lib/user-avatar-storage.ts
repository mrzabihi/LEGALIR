// ============================================================
// LEGALIR — User avatar image storage (server-only)
// ============================================================
// A signed-in user can upload a real portrait from disk; the bytes are
// persisted under `.data/user-avatars/<userId>.<ext>` (private, git-ignored)
// and served back through `GET /api/v1/me/avatar`. The stored name is derived
// from the internal user id — never the uploaded file name — so no
// user-supplied path segment ever reaches the filesystem (mirrors
// `lawyer-avatar-storage.ts`).
//
// Only raster formats are accepted (PNG/JPEG/WebP). SVG is deliberately
// refused: it can carry script and would be served from our own origin.

import fs from "node:fs";
import path from "node:path";

/** Where uploaded portraits live. Private + git-ignored, like the lawyer avatars. */
export const USER_AVATAR_ROOT = path.resolve(process.cwd(), ".data", "user-avatars");

/** Hard cap on an uploaded portrait's size. */
export const USER_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

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

export function isAllowedUserAvatarFormat(format: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXT_BY_FORMAT, format);
}

/** A user id reduced to a filesystem-safe token (defence against traversal). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Persist an uploaded portrait and return the URL to store on the profile.
 * Any previously stored file for this user (under a different extension) is
 * removed so exactly one upload exists per account.
 */
export function saveUserAvatar(id: string, format: string, bytes: Buffer): string {
  const ext = EXT_BY_FORMAT[format];
  if (!ext) throw new Error("unsupported avatar format");

  const token = safeId(id);
  fs.mkdirSync(USER_AVATAR_ROOT, { recursive: true });

  for (const other of ALL_EXTENSIONS) {
    if (other === ext) continue;
    try {
      fs.unlinkSync(path.join(USER_AVATAR_ROOT, `${token}.${other}`));
    } catch {
      // No prior file under this extension — nothing to remove.
    }
  }

  const target = path.resolve(USER_AVATAR_ROOT, `${token}.${ext}`);
  // Containment check — mirrors resolveUserAvatar's guarantee.
  if (!target.startsWith(USER_AVATAR_ROOT + path.sep)) throw new Error("invalid avatar path");
  fs.writeFileSync(target, bytes);

  // Cache-busting token: the URL itself is stable, but the body changes on
  // every upload, so the client must never serve a stale cached portrait.
  return `/api/v1/me/avatar?v=${Date.now().toString(36)}`;
}

/** Resolve a stored portrait for a user id, or null when none exists. */
export function resolveUserAvatar(
  id: string
): { absolutePath: string; contentType: string } | null {
  const token = safeId(id);
  for (const ext of ALL_EXTENSIONS) {
    const candidate = path.resolve(USER_AVATAR_ROOT, `${token}.${ext}`);
    if (!candidate.startsWith(USER_AVATAR_ROOT + path.sep)) continue;
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
export function deleteUserAvatar(id: string): void {
  const token = safeId(id);
  for (const ext of ALL_EXTENSIONS) {
    try {
      fs.unlinkSync(path.join(USER_AVATAR_ROOT, `${token}.${ext}`));
    } catch {
      // Already gone.
    }
  }
}
