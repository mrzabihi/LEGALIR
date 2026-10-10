// ============================================================
// LEGALIR — Calculator RULE management · admin authorization + board
// ============================================================
// Proves the two things the platform's rule-management requirement turns on:
//
//   1. The formula/rate/version layer is a Super-Admin-only capability ENFORCED
//      SERVER-SIDE. A normal ADMIN (who legitimately manages a calculator's
//      operational policy) and ADMIN_CONTENT are refused on every `/calculators/
//      rules*` endpoint — read AND write — while remaining able to read the
//      inventory and save the operational settings. Hiding the button is never
//      the boundary.
//
//   2. The «مدیریت فرمول‌ها» board lists EVERY registered calculator (derived
//      from the registry, so none is missing and none is invented), and it
//      reflects the real rule state: a DRAFT shows as a draft without activating;
//      a PUBLISHED version flips the row to `published` with the new version
//      label and last-change provenance.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory — a static import
// would bind (and mutate) the real dev DB. See the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { CalculatorRuleBoardRow, CalculatorRuleVersion } from "@legalir/types";
// Type-only namespace imports are erased at compile time, so they do not bind
// the modules before the test chdirs into its temp DB.
import type * as DbNS from "../db";
import type * as CalculatorsNS from "../calculators";

type Db = typeof DbNS;
type Calculators = typeof CalculatorsNS;

type AdminHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;

let db: Db;
let calculators: Calculators;
let adminGet: AdminHandler;
let adminPost: AdminHandler;
let adminPatch: AdminHandler;

let superId: string;
let superSession: string;
let adminId: string;
let adminSession: string;
let contentId: string;
let contentSession: string;
let userId: string;
let userSession: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/admin";
const DS = "court-fee-1405";
const SLUG = "court-fee";

function segments(...parts: string[]): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function reqWith(session: string, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function board(req: NextRequest): Promise<Response> {
  return adminGet(req, segments("calculators", "rules", "board"));
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-calc-rules-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  calculators = await import("../calculators");

  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPost = route.POST as unknown as AdminHandler;
  adminPatch = route.PATCH as unknown as AdminHandler;

  superId = db.createUser({ mobile: "09121000001", passwordHash: "x" }).id;
  db.setUserRole(superId, "SUPER_ADMIN");
  superSession = db.createSession(superId).id;

  adminId = db.createUser({ mobile: "09121000002", passwordHash: "x" }).id;
  db.setUserRole(adminId, "ADMIN");
  adminSession = db.createSession(adminId).id;

  contentId = db.createUser({ mobile: "09121000003", passwordHash: "x" }).id;
  db.setUserRole(contentId, "ADMIN_CONTENT");
  contentSession = db.createSession(contentId).id;

  userId = db.createUser({ mobile: "09121000004", passwordHash: "x" }).id;
  userSession = db.createSession(userId).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// 1. Board completeness — every registered calculator, none invented
// ============================================================

describe("rule board — completeness", () => {
  it("lists exactly the registered calculators (no gaps, no fabrications)", async () => {
    const res = await board(reqWith(superSession, `${BASE}/calculators/rules/board`));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { items: CalculatorRuleBoardRow[] } };

    const registered = calculators.listCalculators().map((c) => c.def.slug).sort();
    const listed = data.items.map((r) => r.slug).sort();
    expect(listed).toEqual(registered);
    expect(listed.length).toBe(registered.length);
    expect(listed.length).toBeGreaterThanOrEqual(25);
    // A spot-check that a real calculator carries its dataset ids + legal source.
    const courtFee = data.items.find((r) => r.slug === SLUG)!;
    expect(courtFee.datasetIds).toContain(DS);
    expect(courtFee.legalSourceFa.length).toBeGreaterThan(0);
  });

  it("reports the code seed as the in-force source before any override", async () => {
    const res = await board(reqWith(superSession, `${BASE}/calculators/rules/board`));
    const { data } = (await res.json()) as { data: { items: CalculatorRuleBoardRow[] } };
    // No published override exists yet → every row is on its versioned code seed.
    for (const row of data.items) {
      expect(row.rulesState).toBe("code-seed");
      expect(row.effectiveVersion).not.toBeNull();
      expect(row.lastChange).toBeNull();
    }
  });

  it("carries the operational policy alongside (edited elsewhere, shown here)", async () => {
    await adminPatch(
      reqWith(adminSession, `${BASE}/calculators/${SLUG}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, accessTier: "subscription", energyCost: 7 }),
      }),
      segments("calculators", SLUG)
    );
    const res = await board(reqWith(superSession, `${BASE}/calculators/rules/board`));
    const { data } = (await res.json()) as { data: { items: CalculatorRuleBoardRow[] } };
    const row = data.items.find((r) => r.slug === SLUG)!;
    expect(row.accessTier).toBe("subscription");
    expect(row.energyCost).toBe(7);
    // The policy edit did not move the rule state.
    expect(row.rulesState).toBe("code-seed");
  });
});

// ============================================================
// 2. Draft vs publish, reflected on the board
// ============================================================

describe("rule board — draft and publish lifecycle", () => {
  it("a draft appears as a draft and does NOT activate the rule", async () => {
    const save = await adminPost(
      reqWith(superSession, `${BASE}/calculators/rules/${DS}`, {
        method: "POST",
        body: JSON.stringify({ rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "پیش‌نویس" }),
      }),
      segments("calculators", "rules", DS)
    );
    expect(save.status).toBe(200);
    const { data: draft } = (await save.json()) as { data: CalculatorRuleVersion };
    expect(draft.status).toBe("draft");

    const res = await board(reqWith(superSession, `${BASE}/calculators/rules/board`));
    const { data } = (await res.json()) as { data: { items: CalculatorRuleBoardRow[] } };
    const row = data.items.find((r) => r.slug === SLUG)!;
    expect(row.draftVersion).toBe(draft.version);
    expect(row.rulesState).toBe("code-seed"); // still the seed for users
    expect(row.lastChange?.action).toBe("draft");
  });

  it("publishing flips the row to `published` with the new version and provenance", async () => {
    const save = await adminPost(
      reqWith(superSession, `${BASE}/calculators/rules/${DS}`, {
        method: "POST",
        body: JSON.stringify({ rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "انتشار" }),
      }),
      segments("calculators", "rules", DS)
    );
    const { data: draft } = (await save.json()) as { data: CalculatorRuleVersion };

    const pub = await adminPost(
      reqWith(superSession, `${BASE}/calculators/rules/${draft.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId: draft.id }),
      }),
      segments("calculators", "rules", draft.id, "publish")
    );
    expect(pub.status).toBe(200);
    const { data: published } = (await pub.json()) as { data: CalculatorRuleVersion };
    expect(published.status).toBe("published");
    expect(published.version).toBe("court-fee-1405.2");

    const res = await board(reqWith(superSession, `${BASE}/calculators/rules/board`));
    const { data } = (await res.json()) as { data: { items: CalculatorRuleBoardRow[] } };
    const row = data.items.find((r) => r.slug === SLUG)!;
    expect(row.rulesState).toBe("published");
    expect(row.effectiveVersion).toContain("court-fee-1405.2");
    expect(row.draftVersion).toBeNull();
    expect(row.lastChange?.action).toBe("published");
    expect(row.lastChange?.version).toBe("court-fee-1405.2");
  });
});

// ============================================================
// 3. Server-side authorization — Super-Admin-only rule layer
// ============================================================

describe("rule layer authorization (enforced server-side)", () => {
  it("an unauthenticated caller is refused on the board — 401", async () => {
    const res = await adminGet(
      new Request(`${BASE}/calculators/rules/board`) as unknown as NextRequest,
      segments("calculators", "rules", "board")
    );
    expect(res.status).toBe(401);
  });

  it("an ordinary ADMIN cannot read the board — 403", async () => {
    const res = await board(reqWith(adminSession, `${BASE}/calculators/rules/board`));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("an ordinary ADMIN cannot list rule summaries or read a dataset — 403", async () => {
    const list = await adminGet(
      reqWith(adminSession, `${BASE}/calculators/rules`),
      segments("calculators", "rules")
    );
    expect(list.status).toBe(403);

    const detail = await adminGet(
      reqWith(adminSession, `${BASE}/calculators/rules/${DS}`),
      segments("calculators", "rules", DS)
    );
    expect(detail.status).toBe(403);
  });

  it("an ordinary ADMIN cannot save a rule draft — 403", async () => {
    const res = await adminPost(
      reqWith(adminSession, `${BASE}/calculators/rules/${DS}`, {
        method: "POST",
        body: JSON.stringify({ rates: { nonMonetaryFlatRial: 9_000_000 }, changeNoteFa: "hack" }),
      }),
      segments("calculators", "rules", DS)
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("ADMIN_CONTENT is likewise refused on the rule layer — 403", async () => {
    const res = await board(reqWith(contentSession, `${BASE}/calculators/rules/board`));
    expect(res.status).toBe(403);
  });

  it("a plain USER cannot reach the rule layer — 403", async () => {
    const res = await board(reqWith(userSession, `${BASE}/calculators/rules/board`));
    expect(res.status).toBe(403);
  });

  it("an ordinary ADMIN keeps the operational surfaces it legitimately owns", async () => {
    // The inventory read is a calculator-read capability.
    const inv = await adminGet(
      reqWith(adminSession, `${BASE}/calculators`),
      segments("calculators")
    );
    expect(inv.status).toBe(200);

    // Saving the operational policy is a calculator-manage capability.
    const save = await adminPatch(
      reqWith(adminSession, `${BASE}/calculators/${SLUG}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, accessTier: "free", energyCost: 0 }),
      }),
      segments("calculators", SLUG)
    );
    expect(save.status).toBe(200);
  });

  it("the Super Admin reaches the full rule layer — board, list and detail", async () => {
    expect((await board(reqWith(superSession, `${BASE}/calculators/rules/board`))).status).toBe(200);
    const list = await adminGet(
      reqWith(superSession, `${BASE}/calculators/rules`),
      segments("calculators", "rules")
    );
    expect(list.status).toBe(200);
    const detail = await adminGet(
      reqWith(superSession, `${BASE}/calculators/rules/${DS}`),
      segments("calculators", "rules", DS)
    );
    expect(detail.status).toBe(200);
  });
});

// ============================================================
// 4. Permission matrix — the source of truth for the gates above
// ============================================================

describe("rule-layer permission matrix", () => {
  it("only SUPER_ADMIN holds the rule read/manage permissions", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    for (const role of ["ADMIN", "ADMIN_CONTENT", "ADMIN_AI", "ADMIN_FINANCE"] as const) {
      expect(roleHasPermission(role, "admin:calculators:rules:read")).toBe(false);
      expect(roleHasPermission(role, "admin:calculators:rules:manage")).toBe(false);
    }
    expect(roleHasPermission("SUPER_ADMIN", "admin:calculators:rules:read")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "admin:calculators:rules:manage")).toBe(true);
  });

  it("a normal ADMIN still holds the operational policy permissions", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    expect(roleHasPermission("ADMIN", "admin:calculators:read")).toBe(true);
    expect(roleHasPermission("ADMIN", "admin:calculators:manage")).toBe(true);
  });
});
