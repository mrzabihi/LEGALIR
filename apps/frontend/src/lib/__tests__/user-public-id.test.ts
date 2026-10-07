// ============================================================
// LEGALIR — System user id (publicId) uniqueness & backfill
// ============================================================
// Runtime tests against an isolated temp DB. `db.ts` resolves its store
// from `process.cwd()/.data` at import time, so we chdir into a throwaway
// directory *before* the dynamic import to keep the real dev DB untouched.
//
// Pins the properties the admin/user surfaces depend on:
//   1. every new account is created with a readable `LG-…` system id;
//   2. the id is unique across the whole table;
//   3. legacy rows (created before the field) are backfilled exactly once,
//      without ever overwriting an id that already exists; and
//   4. lookup is case-insensitive and returns undefined for unknown ids.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type { DbUser } from "../db";

type Db = typeof dbModule;

let db: Db;
let tmpDir: string;
let originalCwd: string;

const PUBLIC_ID_RE = /^LG-[ACDEFGHJKLMNPQRTUVWXY34679]{8}$/;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-publicid-"));
  process.chdir(tmpDir);
  db = await import("../db");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createUser — system id at creation", () => {
  it("assigns every new account a readable, well-formed system id", () => {
    const a = db.createUser({ mobile: "09120000301", passwordHash: "x" });
    const b = db.createUser({ mobile: "09120000302", passwordHash: "x" });

    expect(a.publicId).toMatch(PUBLIC_ID_RE);
    expect(b.publicId).toMatch(PUBLIC_ID_RE);
  });

  it("never collides across many accounts", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const u = db.createUser({ mobile: `0912001${String(i).padStart(4, "0")}`, passwordHash: "x" });
      expect(u.publicId).toMatch(PUBLIC_ID_RE);
      ids.add(u.publicId as string);
    }
    // All 200 freshly-minted ids are distinct.
    expect(ids.size).toBe(200);
  });
});

describe("findUserByPublicId", () => {
  it("resolves the owner and is case-insensitive", () => {
    const u = db.createUser({ mobile: "09120000401", passwordHash: "x" });
    const byExact = db.findUserByPublicId(u.publicId as string);
    const byLower = db.findUserByPublicId((u.publicId as string).toLowerCase());

    expect(byExact?.id).toBe(u.id);
    expect(byLower?.id).toBe(u.id);
  });

  it("returns undefined for an unknown or empty id", () => {
    expect(db.findUserByPublicId("LG-NOTAREAL")).toBeUndefined();
    expect(db.findUserByPublicId("")).toBeUndefined();
  });
});

describe("ensureUserPublicIds — legacy backfill", () => {
  it("assigns ids to rows that lack one and is idempotent", () => {
    // Seed two legacy rows straight into the table — no publicId, as they
    // would have been written before the field existed.
    const rows = db.readTable<DbUser>("users");
    const legacyA: DbUser = {
      id: crypto.randomUUID(),
      mobile: "09120000501",
      email: null,
      passwordHash: "x",
      displayName: null,
      role: "USER",
      createdAt: new Date().toISOString(),
    };
    const legacyB: DbUser = {
      id: crypto.randomUUID(),
      mobile: "09120000502",
      email: null,
      passwordHash: "x",
      displayName: null,
      role: "USER",
      createdAt: new Date().toISOString(),
    };
    db.writeTable("users", [...rows, legacyA, legacyB]);

    const assigned = db.ensureUserPublicIds();
    expect(assigned).toBeGreaterThanOrEqual(2);

    const after = db.readTable<DbUser>("users");
    const backfilledA = after.find((u) => u.id === legacyA.id);
    const backfilledB = after.find((u) => u.id === legacyB.id);
    expect(backfilledA?.publicId).toMatch(PUBLIC_ID_RE);
    expect(backfilledB?.publicId).toMatch(PUBLIC_ID_RE);
    expect(backfilledA?.publicId).not.toBe(backfilledB?.publicId);

    // A second run must be a no-op — nothing is left unassigned and no
    // existing id is overwritten.
    const before = after.map((u) => u.publicId);
    expect(db.ensureUserPublicIds()).toBe(0);
    expect(db.readTable<DbUser>("users").map((u) => u.publicId)).toEqual(before);
  });
});
