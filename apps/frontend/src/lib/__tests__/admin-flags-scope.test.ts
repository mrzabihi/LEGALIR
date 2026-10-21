// ============================================================
// LEGALIR — Admin feature-flag allow-lists · END-TO-END (temp DB)
// ============================================================
// The /admin/services page used to RENDER `allowedPlans` / `allowedOrgIds`
// without any way to change them. That was a real gap, not cosmetics:
// `isFlagEnabled` reads those lists AHEAD of the rollout bucket, so they are
// the release decision for named plans and named organizations.
//
// This suite proves the contract the new scope drawer relies on:
//
//   · PATCH /admin/flags/:key accepts both lists and PERSISTS them;
//   · a list is replaced wholesale (clearing a chip really removes it);
//   · the change is audited with before → after for BOTH lists, so the
//     operator's release decision is reconstructible from the trail;
//   · `isFlagEnabled` obeys the edited lists — a plan/org added here is
//     enabled, one removed here is not;
//   · a non-admin cannot edit a flag.
//
// `lib/db` resolves `.data` from process.cwd() at module load, so everything
// is imported DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as FlagsModule from "../admin/flags";
import type * as DbModule from "../db";
import type * as AuditModule from "../admin/audit";

type Flags = typeof FlagsModule;
type Db = typeof DbModule;
type Audit = typeof AuditModule;

let flags: Flags;
let db: Db;
let audit: Audit;

type AdminHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ segments: string[] }> }
) => Promise<Response>;

let adminGet: AdminHandler;
let adminPatch: AdminHandler;
let adminSession: string;
let adminId: string;

const KEY = "ai_consultation";
const BASE = "http://localhost/api/v1/admin/flags";

let tmpDir: string;
let originalCwd: string;

function segments(...parts: string[]): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function reqAs(session: string, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function adminReq(url: string, init?: RequestInit): NextRequest {
  return reqAs(adminSession, url, init);
}

function flagRow(key: string) {
  const row = flags.getFlag(key);
  if (!row) throw new Error(`missing flag ${key}`);
  return row;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-flag-scope-"));
  process.chdir(tmpDir);

  db = await import("../db");
  flags = await import("../admin/flags");
  audit = await import("../admin/audit");

  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPatch = route.PATCH as unknown as AdminHandler;

  const admin = db.createUser({ mobile: "09122220000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
  adminSession = db.createSession(adminId).id;

  // Seed the table so the later assertions read real rows.
  flags.listFlags();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("PATCH /admin/flags/:key — allow-lists", () => {
  it("persists both lists and flips the flag to a scoped status", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/${KEY}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "limited",
          rolloutPercent: 10,
          allowedPlans: ["pro", "business"],
          allowedOrgIds: ["org-1", "org-2"],
        }),
      }),
      segments("flags", KEY)
    );
    expect(res.status).toBe(200);

    const row = flagRow(KEY);
    expect(row.status).toBe("limited");
    expect(row.allowedPlans).toEqual(["pro", "business"]);
    expect(row.allowedOrgIds).toEqual(["org-1", "org-2"]);
    expect(row.updatedBy).toBe(adminId);
  });

  it("replaces the lists wholesale — a chip removed in the UI is really gone", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/${KEY}`, {
        method: "PATCH",
        body: JSON.stringify({ allowedPlans: ["pro"], allowedOrgIds: [] }),
      }),
      segments("flags", KEY)
    );
    expect(res.status).toBe(200);

    const row = flagRow(KEY);
    expect(row.allowedPlans).toEqual(["pro"]);
    expect(row.allowedOrgIds).toEqual([]);
    // Untouched fields survive a partial update.
    expect(row.status).toBe("limited");
    expect(row.rolloutPercent).toBe(10);
  });

  it("audits before → after for BOTH lists, not just status and percentage", async () => {
    await adminPatch(
      adminReq(`${BASE}/${KEY}`, {
        method: "PATCH",
        body: JSON.stringify({ allowedPlans: ["pro", "enterprise"], allowedOrgIds: ["org-9"] }),
      }),
      segments("flags", KEY)
    );

    const trail = audit.listAudit({ action: "flag.update", resourceId: KEY });
    expect(trail.total).toBeGreaterThan(0);
    const latest = trail.items[0]!;

    expect(latest.actorUserId).toBe(adminId);
    expect(latest.before).toMatchObject({ allowedPlans: ["pro"], allowedOrgIds: [] });
    expect(latest.after).toMatchObject({
      allowedPlans: ["pro", "enterprise"],
      allowedOrgIds: ["org-9"],
    });
    // Status / percentage stay in the snapshot too.
    expect(latest.before).toHaveProperty("status");
    expect(latest.after).toHaveProperty("rolloutPercent");
  });
});

// ============================================================

describe("isFlagEnabled obeys the edited allow-lists", () => {
  it("enables a plan on the list and a member of an org on the list, regardless of the bucket", () => {
    const env = flagRow(KEY).environment;

    // `pro` was added through the API above.
    expect(flags.isFlagEnabled(KEY, { env, planCode: "pro", bucket: 99 })).toBe(true);
    // `enterprise` was also added.
    expect(flags.isFlagEnabled(KEY, { env, planCode: "enterprise", bucket: 99 })).toBe(true);
    // A plan that is NOT on the list falls through to the 10% bucket.
    expect(flags.isFlagEnabled(KEY, { env, planCode: "free", bucket: 99 })).toBe(false);
    expect(flags.isFlagEnabled(KEY, { env, planCode: "free", bucket: 5 })).toBe(true);
    // An org on the list is enabled even with an empty plan.
    expect(flags.isFlagEnabled(KEY, { env, orgId: "org-9", bucket: 99 })).toBe(true);
    expect(flags.isFlagEnabled(KEY, { env, orgId: "org-other", bucket: 99 })).toBe(false);
  });

  it("an empty allow-list leaves only the rollout percentage in control", () => {
    flags.updateFlag(KEY, { allowedPlans: [], allowedOrgIds: [] }, adminId);
    const env = flagRow(KEY).environment;

    expect(flags.isFlagEnabled(KEY, { env, planCode: "pro", bucket: 99 })).toBe(false);
    expect(flags.isFlagEnabled(KEY, { env, planCode: "pro", bucket: 0 })).toBe(true);
  });
});

// ============================================================

describe("permissions & listing", () => {
  it("GET /admin/flags exposes the two lists so the drawer can seed its draft", async () => {
    flags.updateFlag(KEY, { allowedPlans: ["pro"], allowedOrgIds: ["org-1"] }, adminId);

    const res = await adminGet(adminReq(BASE), segments("flags"));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { items: { key: string; allowedPlans: string[]; allowedOrgIds: string[] }[] };
    };
    const row = data.items.find((f) => f.key === KEY);
    expect(row?.allowedPlans).toEqual(["pro"]);
    expect(row?.allowedOrgIds).toEqual(["org-1"]);
  });

  it("a non-admin cannot edit a flag", async () => {
    const plain = db.createUser({ mobile: "09122220009", passwordHash: "x" });
    const session = db.createSession(plain.id).id;

    const res = await adminPatch(
      reqAs(session, `${BASE}/${KEY}`, {
        method: "PATCH",
        body: JSON.stringify({ allowedPlans: ["everything"] }),
      }),
      segments("flags", KEY)
    );
    expect(res.status).toBe(403);
    expect(flagRow(KEY).allowedPlans).toEqual(["pro"]);
  });
});
