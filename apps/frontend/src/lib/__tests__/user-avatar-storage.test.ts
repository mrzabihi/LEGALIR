// ============================================================
// LEGALIR — user avatar storage tests
// ============================================================
// Uploaded portraits are persisted under the private
// `.data/user-avatars/` root and served back through
// `GET /api/v1/me/avatar`. These tests pin the properties the
// feature depends on:
//   1. a round-trip (save → resolve) returns the exact bytes and
//      the right content type, with exactly ONE file per user;
//   2. a crafted user id can never escape the private root; and
//   3. only raster formats are accepted (SVG is refused).
// Mirrors `lawyer-avatar-storage.test.ts`: static import + explicit
// cleanup of every file the run creates.

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  USER_AVATAR_ROOT,
  deleteUserAvatar,
  isAllowedUserAvatarFormat,
  resolveUserAvatar,
  saveUserAvatar,
} from "../user-avatar-storage";

const created: string[] = [];

afterEach(() => {
  for (const p of created.splice(0)) {
    try {
      fs.unlinkSync(p);
    } catch {
      // already gone
    }
  }
});

/** Track a resolved avatar's absolute path so afterEach can clean it up. */
function track(id: string): string | null {
  const found = resolveUserAvatar(id);
  if (found) created.push(found.absolutePath);
  return found?.absolutePath ?? null;
}

describe("isAllowedUserAvatarFormat", () => {
  it("accepts the raster formats we serve", () => {
    expect(isAllowedUserAvatarFormat("image/png")).toBe(true);
    expect(isAllowedUserAvatarFormat("image/jpeg")).toBe(true);
    expect(isAllowedUserAvatarFormat("image/webp")).toBe(true);
  });

  it("refuses SVG and unknown types", () => {
    // SVG is deliberately unsupported — it can carry script and would be
    // served from our own origin.
    expect(isAllowedUserAvatarFormat("image/svg+xml")).toBe(false);
    expect(isAllowedUserAvatarFormat("image/gif")).toBe(false);
    expect(isAllowedUserAvatarFormat("")).toBe(false);
  });
});

describe("saveUserAvatar / resolveUserAvatar", () => {
  it("round-trips an uploaded portrait", () => {
    const bytes = Buffer.from("not-a-real-png-but-fine-for-storage");
    const url = saveUserAvatar("uavatar-test-roundtrip", "image/png", bytes);
    const absolutePath = track("uavatar-test-roundtrip");

    // The URL is stable but carries a cache-busting query so a re-upload is
    // never served from a stale cache.
    expect(url.startsWith("/api/v1/me/avatar?v=")).toBe(true);
    expect(absolutePath).not.toBeNull();
    expect(fs.readFileSync(absolutePath as string)).toEqual(bytes);

    const found = resolveUserAvatar("uavatar-test-roundtrip");
    expect(found?.contentType).toBe("image/png");
  });

  it("keeps exactly one file per user when the extension changes", () => {
    saveUserAvatar("uavatar-test-single", "image/png", Buffer.from("png"));
    const firstPath = track("uavatar-test-single");
    expect(firstPath).not.toBeNull();

    // Re-upload the same user as JPEG — the prior PNG must be removed so
    // only one source remains.
    saveUserAvatar("uavatar-test-single", "image/jpeg", Buffer.from("jpg"));
    const secondPath = track("uavatar-test-single");

    expect(secondPath).not.toBe(firstPath);
    expect(fs.existsSync(firstPath as string)).toBe(false);

    const found = resolveUserAvatar("uavatar-test-single");
    expect(found?.contentType).toBe("image/jpeg");
  });

  it("returns null when no portrait has been stored", () => {
    expect(resolveUserAvatar("uavatar-test-absent")).toBeNull();
  });

  it("never lets a crafted id escape the private root", () => {
    const bytes = Buffer.from("x");
    saveUserAvatar("../../../evil", "image/png", bytes);
    const found = resolveUserAvatar("../../../evil");
    track("../../../evil");

    expect(found).not.toBeNull();
    expect(found?.absolutePath.startsWith(USER_AVATAR_ROOT + path.sep)).toBe(true);
  });
});

describe("deleteUserAvatar", () => {
  it("removes a stored portrait", () => {
    saveUserAvatar("uavatar-test-delete", "image/webp", Buffer.from("webp"));
    const absolutePath = track("uavatar-test-delete");
    expect(fs.existsSync(absolutePath as string)).toBe(true);

    deleteUserAvatar("uavatar-test-delete");
    expect(fs.existsSync(absolutePath as string)).toBe(false);
  });

  it("is a best-effort no-op when nothing is stored", () => {
    expect(() => deleteUserAvatar("uavatar-test-never-stored")).not.toThrow();
  });
});
