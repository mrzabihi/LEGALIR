// ============================================================
// LEGALIR — lawyer avatar storage tests
// ============================================================
// Uploaded portraits are persisted under the private
// `.data/lawyer-avatars/` root and served back through
// `GET /api/v1/lawyers/[id]/avatar`. These tests pin the two
// properties the feature depends on:
//   1. a round-trip (save → resolve) returns the exact bytes and
//      the right content type, with exactly ONE file per lawyer; and
//   2. a crafted profile id can never escape the private root.
// Mirrors `document-storage-delete.test.ts`: static import + explicit
// cleanup of every file the run creates.
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AVATAR_ROOT,
  deleteLawyerAvatar,
  isAllowedAvatarFormat,
  resolveLawyerAvatar,
  saveLawyerAvatar,
} from "../lawyer-avatar-storage";

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
  const found = resolveLawyerAvatar(id);
  if (found) created.push(found.absolutePath);
  return found?.absolutePath ?? null;
}

describe("isAllowedAvatarFormat", () => {
  it("accepts the raster formats we serve", () => {
    expect(isAllowedAvatarFormat("image/png")).toBe(true);
    expect(isAllowedAvatarFormat("image/jpeg")).toBe(true);
    expect(isAllowedAvatarFormat("image/webp")).toBe(true);
  });

  it("refuses SVG and unknown types", () => {
    // SVG is deliberately unsupported — it can carry script and would be
    // served from our own origin.
    expect(isAllowedAvatarFormat("image/svg+xml")).toBe(false);
    expect(isAllowedAvatarFormat("image/gif")).toBe(false);
    expect(isAllowedAvatarFormat("")).toBe(false);
  });
});

describe("saveLawyerAvatar / resolveLawyerAvatar", () => {
  it("round-trips an uploaded portrait", () => {
    const bytes = Buffer.from("not-a-real-png-but-fine-for-storage");
    const url = saveLawyerAvatar("avatar-test-roundtrip", "image/png", bytes);
    const absolutePath = track("avatar-test-roundtrip");

    expect(url).toBe("/api/v1/lawyers/avatar-test-roundtrip/avatar");
    expect(absolutePath).not.toBeNull();
    expect(fs.readFileSync(absolutePath as string)).toEqual(bytes);

    const found = resolveLawyerAvatar("avatar-test-roundtrip");
    expect(found?.contentType).toBe("image/png");
  });

  it("keeps exactly one file per lawyer when the extension changes", () => {
    saveLawyerAvatar("avatar-test-single", "image/png", Buffer.from("png"));
    const firstPath = track("avatar-test-single");
    expect(firstPath).not.toBeNull();

    // Re-upload the same lawyer as JPEG — the prior PNG must be removed so
    // only one source remains.
    saveLawyerAvatar("avatar-test-single", "image/jpeg", Buffer.from("jpg"));
    const secondPath = track("avatar-test-single");

    expect(secondPath).not.toBe(firstPath);
    expect(fs.existsSync(firstPath as string)).toBe(false);

    const found = resolveLawyerAvatar("avatar-test-single");
    expect(found?.contentType).toBe("image/jpeg");
  });

  it("returns null when no portrait has been stored", () => {
    expect(resolveLawyerAvatar("avatar-test-absent")).toBeNull();
  });

  it("never lets a crafted id escape the private root", () => {
    const bytes = Buffer.from("x");
    saveLawyerAvatar("../../../evil", "image/png", bytes);
    const found = resolveLawyerAvatar("../../../evil");
    track("../../../evil");

    expect(found).not.toBeNull();
    expect(found?.absolutePath.startsWith(AVATAR_ROOT + path.sep)).toBe(true);
  });
});

describe("deleteLawyerAvatar", () => {
  it("removes a stored portrait", () => {
    saveLawyerAvatar("avatar-test-delete", "image/webp", Buffer.from("webp"));
    const absolutePath = track("avatar-test-delete");
    expect(fs.existsSync(absolutePath as string)).toBe(true);

    deleteLawyerAvatar("avatar-test-delete");
    expect(fs.existsSync(absolutePath as string)).toBe(false);
  });

  it("is a best-effort no-op when nothing is stored", () => {
    expect(() => deleteLawyerAvatar("avatar-test-never-stored")).not.toThrow();
  });
});
