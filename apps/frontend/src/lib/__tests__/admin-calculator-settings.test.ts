// ============================================================
// LEGALIR — Calculator operational settings (§5, hermetic)
// ============================================================
// Covers the admin-editable per-calculator policy store and its enforcement:
//
//   • decideCalculatorAccess   — pure tier/allow-list decisions
//   • saveCalculatorSetting     — validation + upsert round-trip
//   • authorizeCalculatorRun    — enabled/tier gate + REAL energy charge
//
// `@/lib/db`, the calculator registry, and the usage engine are mocked so the
// suite is hermetic — it asserts the policy is enforced and that a charged run
// goes through the ONE usage engine with the admin's `energyCost`.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  reserveCalls: [] as Record<string, unknown>[],
  completeCalls: [] as string[],
  entitlement: { isFree: true, planCode: null as string | null },
  reserveResult: {
    ok: true,
    code: null as string | null,
    messageFa: "",
    transaction: { id: "utx-1" } as { id: string } | null,
    replayed: false,
  },
}));

vi.mock("@/lib/db", () => ({
  readTable: () => state.rows,
  writeTable: (_name: string, data: unknown) => {
    state.rows = data as Record<string, unknown>[];
  },
}));

vi.mock("@/lib/calculators", () => ({
  getCalculator: (slug: string) =>
    slug === "known-calc" || slug === "other-calc" ? { def: { slug } } : undefined,
  listCalculators: () => [{ def: { slug: "known-calc" } }, { def: { slug: "other-calc" } }],
}));

vi.mock("@/lib/usage/engine", () => ({
  resolveEntitlement: () => ({
    isFree: state.entitlement.isFree,
    planCode: state.entitlement.planCode,
  }),
  reserveUsage: (params: Record<string, unknown>) => {
    state.reserveCalls.push(params);
    return state.reserveResult;
  },
  completeUsage: (id: string) => {
    state.completeCalls.push(id);
    return null;
  },
}));

vi.mock("@/lib/rewards", () => ({
  tehranDateString: () => "2026-10-06",
}));

// Imported AFTER the mocks are registered.
import {
  listCalculatorSettings,
  getCalculatorSetting,
  saveCalculatorSetting,
  decideCalculatorAccess,
  authorizeCalculatorRun,
} from "@/lib/admin/calculator-settings";

function setting(over: Record<string, unknown> = {}) {
  return {
    slug: "known-calc",
    enabled: true,
    accessTier: "free" as const,
    energyCost: 0,
    allowedPlans: [] as string[],
    allowedUserIds: [] as string[],
    updatedBy: null as string | null,
    updatedAt: "",
    ...over,
  };
}

beforeEach(() => {
  state.rows = [];
  state.reserveCalls = [];
  state.completeCalls = [];
  state.entitlement = { isFree: true, planCode: null };
  state.reserveResult = {
    ok: true,
    code: null,
    messageFa: "",
    transaction: { id: "utx-1" },
    replayed: false,
  };
});

describe("listCalculatorSettings / getCalculatorSetting", () => {
  it("seeds a default (enabled, free, 0 energy) for a calculator with no stored row", () => {
    const all = listCalculatorSettings();
    expect(all.map((s) => s.slug).sort()).toEqual(["known-calc", "other-calc"]);
    expect(all.every((s) => s.enabled && s.accessTier === "free" && s.energyCost === 0)).toBe(true);
    expect(getCalculatorSetting("known-calc").accessTier).toBe("free");
  });
});

describe("saveCalculatorSetting — validation + upsert", () => {
  it("rejects an unknown calculator", () => {
    const res = saveCalculatorSetting("nope", { enabled: true });
    expect("error" in res && res.error).toBe("CALCULATOR_NOT_FOUND");
  });

  it("rejects an invalid access tier", () => {
    const res = saveCalculatorSetting("known-calc", {
      accessTier: "bogus" as never,
    });
    expect("error" in res && res.error).toBe("INVALID_ACCESS_TIER");
  });

  it("rejects a negative energy cost", () => {
    const res = saveCalculatorSetting("known-calc", { energyCost: -5 });
    expect("error" in res && res.error).toBe("INVALID_ENERGY_COST");
  });

  it("persists a valid policy and stamps the actor", () => {
    const res = saveCalculatorSetting(
      "known-calc",
      { enabled: false, accessTier: "restricted", energyCost: 250, allowedPlans: ["gold"] },
      "admin-1"
    );
    if ("error" in res) throw new Error("unexpected error");
    expect(res.enabled).toBe(false);
    expect(res.accessTier).toBe("restricted");
    expect(res.energyCost).toBe(250);
    expect(res.updatedBy).toBe("admin-1");
    expect(getCalculatorSetting("known-calc").energyCost).toBe(250);
  });
});

describe("decideCalculatorAccess — pure policy", () => {
  const freeCaller = { userId: "u1", isFree: true, planCode: null };
  const paidCaller = { userId: "u2", isFree: false, planCode: "gold" };

  it("denies a disabled calculator regardless of tier", () => {
    const d = decideCalculatorAccess(setting({ enabled: false }), paidCaller);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("DISABLED");
  });

  it("allows anyone when the tier is free", () => {
    expect(decideCalculatorAccess(setting(), freeCaller).allowed).toBe(true);
  });

  it("requires a paid entitlement for subscription/purchase tiers", () => {
    expect(decideCalculatorAccess(setting({ accessTier: "subscription" }), freeCaller).allowed).toBe(false);
    expect(decideCalculatorAccess(setting({ accessTier: "subscription" }), paidCaller).allowed).toBe(true);
    expect(decideCalculatorAccess(setting({ accessTier: "purchase" }), freeCaller).allowed).toBe(false);
  });

  it("restricted honours the user allow-list and the plan allow-list", () => {
    const s = setting({ accessTier: "restricted", allowedUserIds: ["u1"], allowedPlans: ["gold"] });
    expect(decideCalculatorAccess(s, { userId: "u1", isFree: true, planCode: null }).allowed).toBe(true);
    expect(decideCalculatorAccess(s, { userId: "u9", isFree: true, planCode: null }).allowed).toBe(false);
    expect(decideCalculatorAccess(s, { userId: "u9", isFree: false, planCode: "gold" }).allowed).toBe(true);
    expect(decideCalculatorAccess(s, { userId: "u9", isFree: false, planCode: "silver" }).reason).toBe("RESTRICTED");
  });
});

describe("authorizeCalculatorRun — real energy enforcement", () => {
  it("denies an unknown calculator", () => {
    const res = authorizeCalculatorRun("nope", "u1");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CALCULATOR_NOT_FOUND");
    expect(state.reserveCalls).toHaveLength(0);
  });

  it("denies a disabled calculator without charging", () => {
    saveCalculatorSetting("known-calc", { enabled: false, energyCost: 100 });
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("DISABLED");
    expect(state.reserveCalls).toHaveLength(0);
  });

  it("denies a subscription-tier calculator for a free user", () => {
    saveCalculatorSetting("known-calc", { accessTier: "subscription" });
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(state.reserveCalls).toHaveLength(0);
  });

  it("allows a free run without writing a ledger row", () => {
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(true);
    expect(res.energyCost).toBe(0);
    expect(res.transactionId).toBeNull();
    expect(state.reserveCalls).toHaveLength(0);
  });

  it("charges the admin energyCost through the ONE usage engine", () => {
    saveCalculatorSetting("known-calc", { energyCost: 300 });
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(true);
    expect(res.energyCost).toBe(300);
    expect(res.transactionId).toBe("utx-1");
    expect(state.reserveCalls).toHaveLength(1);
    const call = state.reserveCalls[0]!;
    expect(call["activity"]).toBe("LEGAL_CALCULATION");
    expect(call["overridePoints"]).toBe(300);
    expect(call["idempotencyKey"]).toBe("calc:known-calc:u1:2026-10-06");
    expect(state.completeCalls).toEqual(["utx-1"]);
  });

  it("does not double-charge a replayed reservation (same day)", () => {
    saveCalculatorSetting("known-calc", { energyCost: 300 });
    state.reserveResult = { ...state.reserveResult, replayed: true };
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(true);
    expect(res.energyCost).toBe(0);
    expect(res.transactionId).toBe("utx-1");
  });

  it("surfaces a quota denial from the engine", () => {
    saveCalculatorSetting("known-calc", { energyCost: 300 });
    state.reserveResult = {
      ok: false,
      code: "DAILY_POINTS_EXCEEDED",
      messageFa: "اعتبار روزانه به پایان رسیده است.",
      transaction: null,
      replayed: false,
    };
    const res = authorizeCalculatorRun("known-calc", "u1");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("DAILY_POINTS_EXCEEDED");
    expect(state.completeCalls).toHaveLength(0);
  });
});
