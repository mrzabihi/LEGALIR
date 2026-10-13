// ============================================================
// LEGALIR — Mobile identity: one number, one account
// ============================================================
// Proves the acceptance criteria for the mobile-unification task:
//   * every accepted input format resolves to the SAME stored identity
//   * the identity phone is stored canonically (E.164)
//   * a second signup with a different format of the same number is
//     rejected (no duplicate accounts), including a concurrent race
//   * invalid input is rejected at the boundary, never stored
//
// Runs against an isolated temp DB (see points-account.test.ts for the
// chdir-before-import rationale). Each test uses its own number so the
// shared temp store never leaks state between cases.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import { toE164Display } from "@legalir/validation";

type Db = typeof dbModule;

let db: Db;
let MobileConflictError: Db["MobileConflictError"];
let tmpDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-mobile-"));
  process.chdir(tmpDir);
  // Import AFTER chdir so db.ts binds its store to the temp dir. A
  // top-level value import would initialize it against the real .data.
  db = await import("../db");
  MobileConflictError = db.MobileConflictError;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Build the accepted spellings of one national number (10 digits, 9…). */
function formatsOf(national: string): string[] {
  return [
    `0${national}`,
    national,
    `+98${national}`,
    `0098${national}`,
    `98${national}`,
    `0${national}`.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!),
    `0${national}`.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!),
    `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
    `0${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`,
    `+98 (${national.slice(0, 3)}) ${national.slice(3, 6)} ${national.slice(6)}`,
  ];
}

describe("mobile identity — one number, one account", () => {
  it("stores the identity phone canonically (E.164)", () => {
    const user = db.createUser({ mobile: "09123456789", passwordHash: "x" });
    expect(user.mobile).toBe("+989123456789");
  });

  it("resolves every accepted format to the same account", () => {
    const national = "9123456788";
    const canonical = `+98${national}`;
    const user = db.createUser({ mobile: `0${national}`, passwordHash: "x" });
    expect(user.mobile).toBe(canonical);
    for (const format of formatsOf(national)) {
      expect(db.findUserByMobile(format)?.id, `format: ${format}`).toBe(user.id);
    }
  });

  it("rejects a second signup with a different format of the same number", () => {
    const national = "9123456790";
    db.createUser({ mobile: `0${national}`, passwordHash: "x" });
    for (const format of formatsOf(national)) {
      expect(
        () => db.createUser({ mobile: format, passwordHash: "x" }),
        `format: ${format}`
      ).toThrow(MobileConflictError);
    }
  });

  it("a concurrent signup race cannot create a duplicate account", () => {
    const national = "9123456791";
    const canonical = `+98${national}`;
    // Two requests, two formats, same number. The single-writer
    // read-modify-write in createUser makes the second one lose.
    const first = db.createUser({ mobile: `0${national}`, passwordHash: "x" });
    let secondError: unknown = null;
    try {
      db.createUser({ mobile: canonical, passwordHash: "x" });
    } catch (err) {
      secondError = err;
    }
    expect(secondError).toBeInstanceOf(MobileConflictError);

    const matches = db
      .readTable<{ id: string; mobile: string }>("users")
      .filter((u) => u.mobile === canonical);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe(first.id);
  });

  it("rejects invalid input at the boundary instead of storing it", () => {
    for (const bad of ["", "0912", "08123456789", "abc", "++989123456789"]) {
      expect(() => db.createUser({ mobile: bad, passwordHash: "x" }), `input: ${bad}`).toThrow(
        "INVALID_MOBILE"
      );
    }
  });

  it("findUserByMobile returns undefined for invalid input", () => {
    expect(db.findUserByMobile("not-a-number")).toBeUndefined();
    expect(db.findUserByMobile("")).toBeUndefined();
  });

  it("still matches a legacy row stored in the old 09… format", () => {
    // Simulate a pre-migration row written before canonicalization.
    const users = db.readTable<{ id: string; mobile: string }>("users");
    users.push({ id: "legacy-09", mobile: "09129998877" });
    db.writeTable("users", users);

    expect(db.findUserByMobile("09129998877")?.id).toBe("legacy-09");
    expect(db.findUserByMobile("+989129998877")?.id).toBe("legacy-09");
    expect(db.findUserByMobile("00989129998877")?.id).toBe("legacy-09");
  });
});

// ============================================================
// toE164Display — the admin panel's full, LTR-readable rendering
// ============================================================
// The stored identity is canonical E.164 (`+989123456789`); the admin panel
// shows that SAME canonical form so an operator sees the country code and the
// `+` in full. This is a DISPLAY projection only — it never rewrites the
// stored value, so no digit is added or dropped and the order holds.

describe("toE164Display — full E.164 display", () => {
  it("renders the canonical form of the full number, `+` and country code intact", () => {
    expect(toE164Display("+989142080937")).toBe("+989142080937");
    expect(toE164Display("+989131077363")).toBe("+989131077363");
  });

  it("resolves EVERY accepted format to the same canonical display", () => {
    const national = "9123456789";
    for (const format of formatsOf(national)) {
      expect(toE164Display(format), `input: ${format}`).toBe(`+98${national}`);
    }
  });

  it("normalises a legacy 09… row to the same canonical display", () => {
    expect(toE164Display("09123456789")).toBe("+989123456789");
  });

  it("returns an unrecognised value unchanged (never a digit added or dropped)", () => {
    expect(toE164Display("")).toBe("");
    expect(toE164Display("not-a-number")).toBe("not-a-number");
  });
});
