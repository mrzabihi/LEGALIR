// ============================================================
// LEGALIR — Checkout flow (server-authoritative purchase, temp DB)
// ============================================================
// Drives the three REAL checkout route handlers against a throwaway DB and
// proves the invariants the purchase redesign depends on:
//
//   • the client never sends an amount — every figure comes from the server
//     quote, which is a pure function of the catalog plan + resolved coupon;
//   • a coupon is judged in ONE place with a deterministic error precedence,
//     and distinct, actionable codes for each failure reason;
//   • a payment-free order (final === 0) activates + consumes the coupon NOW,
//     while a positive order parks at `awaiting_payment` and consumes NOTHING;
//   • a repeated commit with the same Idempotency-Key returns the SAME order;
//   • the amount that was PREVIEWED equals the amount that is COMMITTED.
//
// `db.ts` resolves `.data` from `process.cwd()` at import, so every module is
// dynamically imported AFTER chdir into an isolated temp dir (the same pattern
// the other temp-DB suites use). Type-only imports are erased and safe.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as DbModule from "../db";
import type * as CouponStore from "../coupons/store";
import type * as Lifecycle from "../subscription/lifecycle";
import type * as CheckoutOrders from "../checkout/orders";
import type { Coupon } from "@legalir/types";

type Db = typeof DbModule;
type Life = typeof Lifecycle;
type Orders = typeof CheckoutOrders;

let db: Db;
let store: typeof CouponStore;
let life: Life;
let orders: Orders;

let quotePOST: (req: Request) => Promise<Response>;
let validatePOST: (req: Request) => Promise<Response>;
let commitPOST: (req: Request) => Promise<Response>;

let session: string;
let userId: string;
let tmpDir: string;
let originalCwd: string;

const IDEMPOTENCY_HEADER = "Idempotency-Key";
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** Build a POST request against a checkout route, authenticated by default. */
function post(
  url: string,
  body: unknown,
  opts: { auth?: boolean; idempotencyKey?: string } = {}
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== false) headers["cookie"] = `legalir-session=${session}`;
  if (opts.idempotencyKey) headers[IDEMPOTENCY_HEADER] = opts.idempotencyKey;
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** Create an active coupon in the store; override any draft field. */
function makeCoupon(over: Partial<CouponStore.CouponDraft> & { code: string }): Coupon {
  const draft: CouponStore.CouponDraft = {
    title: "کد تخفیف آزمایشی",
    kind: "percent",
    value: 10,
    percentCap: 100,
    eligiblePlans: [],
    startsAt: daysAgo(1),
    endsAt: daysAgo(-30),
    minOrderAmount: 0,
    totalUses: 0,
    perUserLimit: 0,
    status: "active",
    internalNotes: "یادداشت داخلی",
    currency: "IRT",
    ...over,
  };
  const res = store.createCoupon(draft, "admin-1");
  if (!res.ok) throw new Error(`createCoupon failed: ${res.error}`);
  return res.coupon;
}

interface QuoteData {
  data: {
    quote: {
      planCode: string;
      currency: string;
      listPrice: number;
      basePrice: number;
      discountAmount: number;
      discountPercent: number;
      taxAmount: number;
      taxRatePercent: number;
      taxLabelFa: string;
      otherAmount: number;
      finalAmount: number;
      requiresPayment: boolean;
      coupon: { code: string; kind: string; value: number; discountAmount: number } | null;
      lines: { key: string; labelFa: string; amount: number }[];
    };
    couponError: { code: string; messageFa: string } | null;
  };
}

interface OrderData {
  data: {
    order: {
      id: string;
      referenceId: string;
      planCode: string;
      status: string;
      statusFa: string;
      currency: string;
      basePrice: number;
      discountAmount: number;
      discountPercent: number;
      couponCode: string | null;
      taxAmount: number;
      finalAmount: number;
      collectedAmount: number;
      requiresPayment: boolean;
      gateway: string;
      subscriptionId: string | null;
      startAt: string | null;
      endAt: string | null;
    };
    messageFa: string;
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-checkout-flow-"));
  process.chdir(tmpDir);

  db = await import("../db");
  store = await import("../coupons/store");
  life = await import("../subscription/lifecycle");
  orders = await import("../checkout/orders");
  quotePOST = (await import("@/app/api/v1/checkout/quote/route")).POST as typeof quotePOST;
  validatePOST = (await import("@/app/api/v1/checkout/coupons/validate/route"))
    .POST as typeof validatePOST;
  commitPOST = (await import("@/app/api/v1/checkout/orders/route")).POST as typeof commitPOST;

  const user = db.createUser({ mobile: "09120000042", passwordHash: "x" });
  userId = user.id;
  session = db.createSession(user.id).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Coupons + orders + subscriptions reset per test; the user/session persist.
  db.writeTable("coupons", []);
  db.writeTable("coupon_usages", []);
  db.writeTable("orders", []);
  db.writeTable("subscriptions", []);
});

// ============================================================
// Quote — the ONE server-authoritative source of every figure
// ============================================================

describe("checkout quote — server-authoritative pricing", () => {
  it("prices a plan from the catalog, never from a client amount", async () => {
    // The client sends an absurd amount; it must be ignored entirely.
    const res = await quotePOST(post("/api/v1/checkout/quote", { planCode: "gold", amount: 1 }));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as QuoteData;

    expect(data.quote.planCode).toBe("gold");
    // base = catalog salePrice (3.5M), list = catalog listPrice (7M).
    expect(data.quote.basePrice).toBe(3_500_000);
    expect(data.quote.listPrice).toBe(7_000_000);
    expect(data.quote.discountAmount).toBe(0);
    expect(data.quote.finalAmount).toBe(3_500_000);
    // No tax rule exists → 0, labelled honestly, never a guessed number.
    expect(data.quote.taxAmount).toBe(0);
    expect(data.quote.taxRatePercent).toBe(0);
    expect(data.quote.taxLabelFa).toBe("بدون مالیات");
    expect(data.quote.requiresPayment).toBe(true);
    expect(data.quote.coupon).toBeNull();
    expect(data.couponError).toBeNull();
  });

  it("applies a percent coupon and reports the discount split", async () => {
    makeCoupon({ code: "OFF10", kind: "percent", value: 10 });
    const res = await quotePOST(
      post("/api/v1/checkout/quote", { planCode: "gold", couponCode: "off10" })
    );
    const { data } = (await res.json()) as QuoteData;
    expect(data.quote.discountAmount).toBe(350_000);
    expect(data.quote.discountPercent).toBe(10);
    expect(data.quote.finalAmount).toBe(3_150_000);
    expect(data.quote.coupon?.code).toBe("OFF10");
    // The rendered discount line carries the negative amount.
    const discountLine = data.quote.lines.find((l) => l.key === "discount")!;
    expect(discountLine.amount).toBe(-350_000);
  });

  it("clamps a fixed coupon at the base so the final is never negative", async () => {
    makeCoupon({ code: "BIG", kind: "fixed", value: 9_999_999 });
    const res = await quotePOST(
      post("/api/v1/checkout/quote", { planCode: "gold", couponCode: "BIG" })
    );
    const { data } = (await res.json()) as QuoteData;
    expect(data.quote.discountAmount).toBe(3_500_000); // clamped to base
    expect(data.quote.finalAmount).toBe(0);
    expect(data.quote.requiresPayment).toBe(false);
  });

  it("reports an invalid coupon without failing the quote", async () => {
    const res = await quotePOST(
      post("/api/v1/checkout/quote", { planCode: "gold", couponCode: "NOPE" })
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as QuoteData;
    expect(data.couponError?.code).toBe("COUPON_NOT_FOUND");
    // …and still shows the honest undiscounted total.
    expect(data.quote.finalAmount).toBe(3_500_000);
    expect(data.quote.coupon).toBeNull();
  });

  it("404s an unknown plan", async () => {
    const missing = await quotePOST(post("/api/v1/checkout/quote", { planCode: "ghost" }));
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { code: string }).code).toBe("PLAN_NOT_FOUND");
  });

  it("requires an authenticated session", async () => {
    const res = await quotePOST(
      post("/api/v1/checkout/quote", { planCode: "gold" }, { auth: false })
    );
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Coupon validation — distinct, actionable error codes
// ============================================================

describe("checkout coupons/validate — one judge, distinct reasons", () => {
  it("accepts a valid coupon and returns the re-quoted total", async () => {
    makeCoupon({ code: "SAVE20", kind: "percent", value: 20 });
    const res = await validatePOST(
      post("/api/v1/checkout/coupons/validate", { planCode: "gold", couponCode: "save20" })
    );
    const { data } = (await res.json()) as {
      data: { valid: boolean; errorCode: string | null; quote: { finalAmount: number } };
    };
    expect(data.valid).toBe(true);
    expect(data.errorCode).toBeNull();
    expect(data.quote.finalAmount).toBe(2_800_000);
  });

  it.each([
    ["COUPON_NOT_FOUND", { code: "ABSENT" }],
    ["COUPON_EXPIRED", { code: "OLD", startsAt: daysAgo(30), endsAt: daysAgo(1) }],
    ["COUPON_DISABLED", { code: "OFF", status: "disabled" as const }],
    ["COUPON_ARCHIVED", { code: "GONE", status: "archived" as const }],
    ["COUPON_NOT_STARTED", { code: "SOON", startsAt: daysAgo(-5), endsAt: daysAgo(-10) }],
    ["PLAN_NOT_ELIGIBLE", { code: "SILVERONLY", eligiblePlans: ["silver"] }],
    ["MIN_ORDER_NOT_MET", { code: "BIGORDER", minOrderAmount: 9_000_000 }],
  ])("returns %s with a customer-safe message", async (expected, draft) => {
    if (draft.code !== "ABSENT")
      makeCoupon(draft as Partial<CouponStore.CouponDraft> & { code: string });
    const res = await validatePOST(
      post("/api/v1/checkout/coupons/validate", {
        planCode: "gold",
        couponCode: draft.code,
      })
    );
    const { data } = (await res.json()) as {
      data: { valid: boolean; errorCode: string; messageFa: string };
    };
    expect(data.valid).toBe(false);
    expect(data.errorCode).toBe(expected);
    expect(typeof data.messageFa).toBe("string");
    expect(data.messageFa.length).toBeGreaterThan(0);
  });

  it("reports capacity exhaustion as COUPON_LIMIT_REACHED", async () => {
    const c = makeCoupon({ code: "ONCE", totalUses: 1, kind: "percent", value: 100 });
    // Consume the single unit via a free order (final === 0).
    await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold", couponCode: "ONCE" },
        { idempotencyKey: "k-limit-1" }
      )
    );
    expect(store.countUsages(c.id)).toBe(1);
    const res = await validatePOST(
      post("/api/v1/checkout/coupons/validate", { planCode: "gold", couponCode: "ONCE" })
    );
    const { data } = (await res.json()) as { data: { errorCode: string } };
    expect(data.errorCode).toBe("COUPON_LIMIT_REACHED");
  });

  it("enforces a per-user limit as USER_COUPON_LIMIT_REACHED", async () => {
    makeCoupon({ code: "PERUSER", perUserLimit: 1, kind: "percent", value: 100 });
    await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold", couponCode: "PERUSER" },
        { idempotencyKey: "k-peruser-1" }
      )
    );
    const res = await validatePOST(
      post("/api/v1/checkout/coupons/validate", { planCode: "gold", couponCode: "PERUSER" })
    );
    const { data } = (await res.json()) as { data: { errorCode: string } };
    expect(data.errorCode).toBe("USER_COUPON_LIMIT_REACHED");
  });

  it("never consumes capacity by validating (validation is read-only)", async () => {
    const c = makeCoupon({ code: "READONLY", totalUses: 5 });
    for (let i = 0; i < 3; i++) {
      await validatePOST(
        post("/api/v1/checkout/coupons/validate", { planCode: "gold", couponCode: "READONLY" })
      );
    }
    expect(store.countUsages(c.id)).toBe(0);
  });
});

// ============================================================
// Order commit — behaviour decided ONLY by the final amount
// ============================================================

describe("checkout orders — free path (final amount is zero)", () => {
  it("activates immediately, consumes the coupon and records no_payment_required", async () => {
    const c = makeCoupon({ code: "FREE100", kind: "percent", value: 100 });
    const res = await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold", couponCode: "FREE100" },
        { idempotencyKey: "k-free-1" }
      )
    );
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as OrderData;

    expect(data.order.status).toBe("no_payment_required");
    expect(data.order.statusFa).toBe("بدون نیاز به پرداخت");
    expect(data.order.finalAmount).toBe(0);
    expect(data.order.collectedAmount).toBe(0);
    expect(data.order.requiresPayment).toBe(false);
    expect(data.order.gateway).toBe("none");
    expect(data.order.subscriptionId).toBeTruthy();

    // The subscription was ACTIVATED with a real term.
    const sub = life.getSubscriptionById(data.order.subscriptionId!)!;
    expect(sub.status).toBe("active");
    expect(sub.user_id).toBe(userId);
    expect(sub.start_at).toBeTruthy();
    expect(new Date(sub.end_at).getTime()).toBeGreaterThan(Date.now());

    // …and the coupon is consumed definitively.
    expect(store.countUsages(c.id)).toBe(1);
  });
});

describe("checkout orders — positive path (final amount > 0)", () => {
  it("parks at awaiting_payment, activates nothing and consumes no coupon", async () => {
    const c = makeCoupon({ code: "TEN", kind: "percent", value: 10 });
    const res = await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold", couponCode: "TEN" },
        { idempotencyKey: "k-paid-1" }
      )
    );
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as OrderData;

    expect(data.order.status).toBe("awaiting_payment");
    expect(data.order.finalAmount).toBe(3_150_000);
    expect(data.order.collectedAmount).toBe(0);
    expect(data.order.requiresPayment).toBe(true);
    // The real gateway is inactive → labelled mock, never a fabricated success.
    expect(data.order.gateway).toBe("mock");

    // The linked subscription exists but is PENDING — NOT activated.
    const sub = life.getSubscriptionById(data.order.subscriptionId!)!;
    expect(sub.status).toBe("pending");
    expect(sub.start_at).toBe("");

    // The coupon is NOT consumed until a real payment settles.
    expect(store.countUsages(c.id)).toBe(0);
  });
});

// ============================================================
// Idempotency, validation and auth guards
// ============================================================

describe("checkout orders — idempotency & guards", () => {
  it("returns the SAME order for a repeated Idempotency-Key", async () => {
    const body = { planCode: "silver" };
    const first = await commitPOST(
      post("/api/v1/checkout/orders", body, { idempotencyKey: "k-dup" })
    );
    const second = await commitPOST(
      post("/api/v1/checkout/orders", body, { idempotencyKey: "k-dup" })
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(200); // replayed
    const a = (await first.json()) as OrderData;
    const b = (await second.json()) as OrderData;
    expect(b.data.order.id).toBe(a.data.order.id);
    // Exactly ONE order + ONE subscription were written.
    expect(orders.listOrdersForUser(userId).length).toBe(1);
  });

  it("rejects a commit with no Idempotency-Key", async () => {
    const res = await commitPOST(post("/api/v1/checkout/orders", { planCode: "gold" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("404s an unknown plan", async () => {
    const res = await commitPOST(
      post("/api/v1/checkout/orders", { planCode: "ghost" }, { idempotencyKey: "k-ghost" })
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("PLAN_NOT_FOUND");
  });

  it("409s an invalid coupon and writes NO order", async () => {
    const res = await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold", couponCode: "NOPE" },
        { idempotencyKey: "k-bad-coupon" }
      )
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("COUPON_NOT_FOUND");
    expect(orders.listOrdersForUser(userId).length).toBe(0);
  });

  it("requires an authenticated session", async () => {
    const res = await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "gold" },
        { auth: false, idempotencyKey: "k-anon" }
      )
    );
    expect(res.status).toBe(401);
  });
});

// ============================================================
// The core guarantee — previewed amount === committed amount
// ============================================================

describe("checkout — preview and commit can never disagree", () => {
  it("commits exactly the final amount the quote previewed", async () => {
    makeCoupon({ code: "MATCH", kind: "percent", value: 15 });
    const q = await quotePOST(
      post("/api/v1/checkout/quote", { planCode: "diamond", couponCode: "MATCH" })
    );
    const quoted = ((await q.json()) as QuoteData).data.quote;

    const o = await commitPOST(
      post(
        "/api/v1/checkout/orders",
        { planCode: "diamond", couponCode: "MATCH" },
        { idempotencyKey: "k-match" }
      )
    );
    const committed = ((await o.json()) as OrderData).data.order;

    expect(committed.basePrice).toBe(quoted.basePrice);
    expect(committed.discountAmount).toBe(quoted.discountAmount);
    expect(committed.taxAmount).toBe(quoted.taxAmount);
    expect(committed.finalAmount).toBe(quoted.finalAmount);
  });
});
