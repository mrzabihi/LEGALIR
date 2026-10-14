// ============================================================
// LEGALIR — GET /api/v1/capabilities (consumer view of admin flags)
// ============================================================
// Locks in the rule /Suggest_law depends on: the endpoint returns the REAL,
// admin-managed flag state for the CALLER, so a service switched off by an
// operator is reported `enabled: false` — never silently omitted and never
// faked on. It is the read-only projection of `lib/admin/flags`.
//
// `lib/db` resolves `.data` from `process.cwd()` at module load, so every
// module (db, flags, the route) is dynamically imported AFTER chdir into a
// throwaway directory — the real dev store is never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "@/lib/db";
import type * as flagsModule from "@/lib/admin/flags";
import type * as capsRoute from "@/app/api/v1/capabilities/route";

type Db = typeof dbModule;
type Flags = typeof flagsModule;

let db: Db;
let flags: Flags;
let GET: typeof capsRoute.GET;
let tmpDir: string;
let originalCwd: string;

const USER_ID = "u-caps-test";
let sessionId: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-caps-"));
  process.chdir(tmpDir);
  db = await import("@/lib/db");
  flags = await import("@/lib/admin/flags");
  GET = (await import("@/app/api/v1/capabilities/route")).GET;
  sessionId = db.createSession(USER_ID).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function authedRequest(): Request {
  return new Request("http://localhost/api/v1/capabilities", {
    headers: { cookie: `legalir-session=${sessionId}` },
  });
}

describe("GET /api/v1/capabilities", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await GET(new Request("http://localhost/api/v1/capabilities"));
    expect(res.status).toBe(401);
  });

  it("mirrors the seeded flag state for an authenticated caller", async () => {
    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    const caps = body.data.capabilities as { key: string; enabled: boolean; nameFa: string }[];
    expect(Array.isArray(caps)).toBe(true);

    const byKey = new Map(caps.map((c) => [c.key, c]));
    // A seeded "on" capability is enabled …
    expect(byKey.get("ai_consultation")?.enabled).toBe(true);
    // … and a seeded "off" capability is present but disabled (never dropped).
    expect(byKey.has("export_data")).toBe(true);
    expect(byKey.get("export_data")?.enabled).toBe(false);

    // Every capability carries a Persian name and the environment.
    expect(caps.every((c) => c.nameFa.length > 0)).toBe(true);
    expect(typeof body.data.environment).toBe("string");
  });

  it("reflects an operator switching a service OFF (the /admin/services write)", async () => {
    flags.updateFlag("ai_consultation", { status: "off", rolloutPercent: 0 }, "admin-1");

    const res = await GET(authedRequest());
    const body = await res.json();
    const ai = (body.data.capabilities as { key: string; enabled: boolean }[]).find(
      (c) => c.key === "ai_consultation"
    );
    expect(ai?.enabled).toBe(false);
  });
});
