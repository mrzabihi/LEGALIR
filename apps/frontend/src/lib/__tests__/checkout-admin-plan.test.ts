// ============================================================
// LEGALIR — Checkout accepts admin-created plans (temp DB)
// ============================================================
// The regression this locks in: the purchase entry point used to validate the
// planCode against a hard-coded allow-list (`silver`/`gold`/`diamond`) and to
// report a hard-coded 31-day term. That meant an admin-created plan could never
// be bought (INVALID_PLAN) even though the catalog listed it, and an activated
// subscription's real term was mis-reported to the client.
//
// The fix routes the plan through the SAME catalog the admin writes to
// (`getPlanByCode` + `isPurchasable`) and reports the REAL terms. This test
// drives the actual POST route handler against a throwaway DB: create a plan
// with `createPlan`, then assert the checkout accepts it and echoes its true
// duration/limits — and still rejects a plan that does not exist.
//
// `db.ts` resolves `.data` from `process.cwd()` at import, so every module is
// dynamically imported AFTER chdir into an isolated temp dir.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as DbModule from "../db";
import type * as PlansModule from "../usage/plans";

type Db = typeof DbModule;
type Plans = typeof PlansModule;

let db: Db;
let plans: Plans;
let createIntent: (req: NextRequest) => Promise<Response>;
let session: string;

let tmpDir: string;
let originalCwd: string;

function authedReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/v1/checkout/intents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `legalir-session=${session}` },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function anonReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/v1/checkout/intents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-checkout-plan-"));
  process.chdir(tmpDir);

  db = await import("../db");
  plans = await import("../usage/plans");
  createIntent = (await import("@/app/api/v1/checkout/intents/route")).POST as typeof createIntent;

  const user = db.createUser({ mobile: "09121230000", passwordHash: "x" });
  session = db.createSession(user.id).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Admin-created plans are purchasable
// ============================================================

describe("checkout accepts a plan created in the admin catalog", () => {
  it("creates an admin plan and lets the checkout start a purchase for it", async () => {
    const created = plans.createPlan({
      code: "admin-pro",
      nameFa: "پلن حرفه‌ای مدیریتی",
      descriptionFa: "پلن ساخته‌شده در پنل مدیریت",
      durationDays: 90,
      activityCostPoints: 5,
      dailyRequestLimit: 77,
      tokenLimit: 1_234_567,
      aiMessageLimit: 0,
      documentAnalysisLimit: 0,
      contractDraftLimit: 0,
      contractCreationLimit: 0,
      contractCreationUnlimited: false,
      listPrice: 900_000,
      salePrice: 750_000,
      features: ["ویژگی آزمایشی"],
      status: "active",
    });
    if (!("ok" in created)) throw new Error(`createPlan failed: ${created.error}`);

    const res = await createIntent(authedReq({ planCode: "admin-pro" }));
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      data: {
        planCode: string;
        amount: number;
        status: string;
        metadata: { planNameFa: string; durationDays: number; dailyRequests: number; totalTokens: number };
      };
    };
    // The purchase is bound to the admin plan, priced from the catalog.
    expect(body.data.planCode).toBe("admin-pro");
    expect(body.data.amount).toBe(750_000);
    expect(body.data.status).toBe("pending");
    // …and its REAL terms are echoed — never a hard-coded 31 days / 0 limits.
    expect(body.data.metadata.durationDays).toBe(90);
    expect(body.data.metadata.dailyRequests).toBe(77);
    expect(body.data.metadata.totalTokens).toBe(1_234_567);
    expect(body.data.metadata.planNameFa).toBe("پلن حرفه‌ای مدیریتی");
  });

  it("rejects a plan code that does not exist in the catalog", async () => {
    const res = await createIntent(authedReq({ planCode: "ghost-plan-xyz" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_PLAN");
  });

  it("rejects a plan that exists but is not purchasable (draft)", async () => {
    const created = plans.createPlan({
      code: "admin-draft",
      nameFa: "پلن پیش‌نویس",
      descriptionFa: "",
      durationDays: 30,
      activityCostPoints: 1,
      dailyRequestLimit: 10,
      tokenLimit: 1000,
      aiMessageLimit: 0,
      documentAnalysisLimit: 0,
      contractDraftLimit: 0,
      contractCreationLimit: 0,
      contractCreationUnlimited: false,
      listPrice: 100_000,
      salePrice: 100_000,
      features: [],
      status: "draft",
    });
    if (!("ok" in created)) throw new Error(`createPlan failed: ${created.error}`);

    const res = await createIntent(authedReq({ planCode: "admin-draft" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_PLAN");
  });

  it("requires an authenticated session", async () => {
    const res = await createIntent(anonReq({ planCode: "admin-pro" }));
    expect(res.status).toBe(401);
  });
});
