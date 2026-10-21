// ============================================================
// LEGALIR — Admin overview metrics (comparison · attention · composition)
// ============================================================
// The overview is the operator's landing surface, so its arithmetic must be
// provable: a percentage is only shown when the previous window actually has
// data, «attention» only lists categories with a real count, and the request
// composition is computed from real rows — never fabricated.
//
// `@/lib/db` is replaced with an in-memory store; the read-only RAG corpus is
// stubbed empty so `ragReviewCounts()` contributes nothing.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: () => undefined,
  normalizeStoredMobile: (m: string) => m,
}));

vi.mock("@/lib/legal-corpus", () => ({
  readCorpus: () => ({ sources: [] }),
  // `@/lib/admin/rag` re-exports this at module scope, so the mock must
  // define it or importing `metrics` throws before any test runs.
  MAX_LAW_FILE_BYTES: 50 * 1024 * 1024,
}));

import { buildOverview, planDailyMix } from "@/lib/admin/metrics";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function seed(rows: Record<string, unknown[]>) {
  h.tables.clear();
  for (const [k, v] of Object.entries(rows)) h.tables.set(k, structuredClone(v));
}

describe("buildOverview — previous-period comparison", () => {
  beforeEach(() => seed({}));

  it("computes changePct from real current vs previous window data", () => {
    seed({
      subscriptions: [
        { id: "s1", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(5) },
        { id: "s2", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(10) },
        // previous window (30–60 days ago):
        { id: "s3", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(40) },
      ],
    });
    const ov = buildOverview(30);
    const salesCount = ov.kpis.find((k) => k.key === "sales_count")!;
    expect(salesCount.value).toBe(2);
    expect(salesCount.previousValue).toBe(1);
    expect(salesCount.changePct).toBe(100); // (2-1)/1 → +100%
  });

  it("shows changePct=null when the previous window has no data (no fake trend)", () => {
    seed({
      subscriptions: [
        { id: "s1", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(5) },
      ],
    });
    const ov = buildOverview(30);
    const salesCount = ov.kpis.find((k) => k.key === "sales_count")!;
    expect(salesCount.value).toBe(1);
    expect(salesCount.previousValue).toBe(0);
    expect(salesCount.changePct).toBeNull();
  });

  it("marks refund trends as inverse (up = bad)", () => {
    seed({});
    const ov = buildOverview(30);
    expect(ov.kpis.find((k) => k.key === "refunded_amount")!.trend).toBe("inverse");
  });
});

describe("buildOverview — needs attention", () => {
  beforeEach(() => seed({}));

  it("lists only categories with a real count > 0", () => {
    // Seeded with the STORED vocabulary (UPPERCASE) — the same values a real
    // `lawyer_profiles` row holds. The earlier lowercase seeds passed only
    // because the counting code also compared lowercase: the two errors agreed
    // with each other while disagreeing with the database.
    seed({
      lawyer_profiles: [
        { id: "l1", verificationStatus: "PROFILE_SUBMITTED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l2", verificationStatus: "VERIFIED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l3", verificationStatus: "UNDER_REVIEW", isDemo: true, createdAt: daysAgo(3) }, // demo → ignored
      ],
      financial_adjustments: [
        { id: "a1", amount: 10, status: "pending", createdAt: daysAgo(1) },
      ],
    });
    const ov = buildOverview(30);
    const keys = ov.attention.map((a) => a.key);
    expect(keys).toContain("lawyers_pending");
    expect(keys).toContain("refunds_pending");
    expect(ov.attention.find((a) => a.key === "lawyers_pending")!.count).toBe(1);
    expect(ov.attention.find((a) => a.key === "support_overdue")).toBeUndefined();
  });

  it("returns [] when nothing needs attention", () => {
    seed({});
    expect(buildOverview(30).attention).toEqual([]);
  });
});

describe("buildOverview — lawyer KPIs", () => {
  beforeEach(() => seed({}));

  it("counts the STORED (uppercase) statuses, not a parallel lowercase vocabulary", () => {
    seed({
      lawyer_profiles: [
        { id: "l1", verificationStatus: "VERIFIED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l2", verificationStatus: "VERIFIED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l3", verificationStatus: "PROFILE_SUBMITTED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l4", verificationStatus: "DOCUMENTS_SUBMITTED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l5", verificationStatus: "UNDER_REVIEW", isDemo: false, createdAt: daysAgo(3) },
        { id: "l6", verificationStatus: "REJECTED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l7", verificationStatus: "SUSPENDED", isDemo: false, createdAt: daysAgo(3) },
        { id: "l8", verificationStatus: "UNVERIFIED", isDemo: false, createdAt: daysAgo(3) },
        // Demo profiles never contribute to any KPI.
        { id: "d1", verificationStatus: "VERIFIED", isDemo: true, createdAt: daysAgo(3) },
        { id: "d2", verificationStatus: "UNDER_REVIEW", isDemo: true, createdAt: daysAgo(3) },
      ],
    });
    const ov = buildOverview(30);
    const kpiValue = (key: string) => ov.kpis.find((k) => k.key === key)!.value;

    expect(kpiValue("lawyers_total")).toBe(8);
    expect(kpiValue("lawyers_verified")).toBe(2);
    // PROFILE_SUBMITTED + DOCUMENTS_SUBMITTED + UNDER_REVIEW — the shared
    // `isLawyerPendingVerification` definition, not one hand-maintained list.
    expect(kpiValue("lawyers_pending")).toBe(3);
    // An unverified profile is neither verified nor awaiting review.
    expect(kpiValue("lawyers_verified") + kpiValue("lawyers_pending")).toBeLessThan(
      kpiValue("lawyers_total")
    );
  });

  it("links each lawyer KPI into the matching decision bucket", () => {
    seed({
      lawyer_profiles: [
        { id: "l1", verificationStatus: "UNDER_REVIEW", isDemo: false, createdAt: daysAgo(3) },
      ],
    });
    const ov = buildOverview(30);
    const href = (key: string) => ov.kpis.find((k) => k.key === key)!.drillHref;
    // A count the operator cannot act on is a dead end; each one opens the
    // exact slice of /admin/lawyers it was measured from.
    // `demo=false` is not decoration: these KPIs count real profiles only, and
    // the destination must not show a different (larger) set than the number
    // the operator just clicked.
    expect(href("lawyers_total")).toBe("/admin/lawyers?demo=false");
    expect(href("lawyers_verified")).toBe("/admin/lawyers?bucket=APPROVED&demo=false");
    expect(href("lawyers_pending")).toBe("/admin/lawyers?bucket=REVIEW&demo=false");
    expect(ov.attention.find((a) => a.key === "lawyers_pending")!.href).toBe(
      "/admin/lawyers?bucket=REVIEW&demo=false"
    );
  });
});

describe("buildOverview — request composition", () => {
  beforeEach(() => seed({}));
  const req = (id: string, state: string, category: string, ago: number) => ({
    id,
    title: id,
    category,
    state,
    selectedLawyerId: null,
    orgId: null,
    createdAt: daysAgo(ago),
    updatedAt: daysAgo(ago),
  });

  it("groups ACTIVE requests by state in canonical order, excluding zeros", () => {
    seed({
      legal_requests: [
        req("r1", "WAITING_FOR_ACCEPTANCE", "contract", 2),
        req("r2", "IN_PROGRESS", "contract", 2),
        req("r3", "CLOSED", "family", 2), // terminal → excluded from composition
      ],
    });
    const ov = buildOverview(30);
    expect(ov.requestsByState.map((s) => s.key)).toEqual(["WAITING_FOR_ACCEPTANCE", "IN_PROGRESS"]);
    expect(ov.openRequestsTotal).toBe(2);
  });

  it("groups window requests by category, sorted desc with Persian labels", () => {
    seed({
      legal_requests: [
        req("r1", "DRAFT", "contract", 2),
        req("r2", "DRAFT", "contract", 3),
        req("r3", "DRAFT", "family", 4),
        req("r4", "DRAFT", "contract", 100), // outside the window → not counted here
      ],
    });
    const ov = buildOverview(30);
    const top = ov.requestsByCategory[0]!;
    expect(top.key).toBe("contract");
    expect(top.count).toBe(2);
    expect(top.labelFa).toBe("قرارداد");
  });

  it("emits one daily point per day in the window", () => {
    seed({ legal_requests: [req("r1", "DRAFT", "contract", 1)] });
    const ov = buildOverview(7);
    expect(ov.dailyRequests.length).toBeGreaterThanOrEqual(7);
    expect(ov.dailyRequests.reduce((s, d) => s + d.count, 0)).toBe(1);
  });
});

describe("buildOverview — explicit window", () => {
  beforeEach(() => seed({}));

  it("honors an explicit from/to window over rangeDays", () => {
    seed({
      legal_requests: [
        {
          id: "r1",
          title: "r1",
          category: "contract",
          state: "DRAFT",
          selectedLawyerId: null,
          orgId: null,
          createdAt: new Date("2026-03-10T12:00:00Z").toISOString(),
          updatedAt: new Date("2026-03-10T12:00:00Z").toISOString(),
        },
      ],
    });
    const ov = buildOverview(30, { from: "2026-03-01", to: "2026-03-31" });
    const reqKpi = ov.kpis.find((k) => k.key === "requests_in_range")!;
    expect(reqKpi.value).toBe(1);
    expect(ov.comparison).not.toBeNull();
    expect(ov.comparison!.windowDays).toBe(31);
  });
});

describe("planDailyMix — plan-mix stacked series", () => {
  beforeEach(() => seed({}));

  it("stacks selling orders by plan with a fixed, aligned plan axis", () => {
    seed({
      subscriptions: [
        { id: "s1", user_id: "u1", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(1) },
        { id: "s2", user_id: "u1", plan_code: "gold", plan_name_fa: "طلایی", amount: 100, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(1) },
        { id: "s3", user_id: "u2", plan_code: "silver", plan_name_fa: "نقره‌ای", amount: 50, currency: "IRT", status: "active", status_fa: "فعال", purchased_at: daysAgo(2) },
      ],
    });
    const mix = planDailyMix(7);
    // Plans are ordered by total volume: gold (2) before silver (1).
    expect(mix.plans.map((p) => p.planCode)).toEqual(["gold", "silver"]);
    // Every day carries one value per plan — a fixed axis, no gaps.
    for (const d of mix.days) expect(d.values).toHaveLength(2);
    expect(mix.days.length).toBeGreaterThanOrEqual(7);
    // The stack sums to the whole earning-sale count over the window.
    const total = mix.days.reduce((s, d) => s + d.values.reduce((a, v) => a + v, 0), 0);
    expect(total).toBe(3);
    // A day with no sale contributes zeros, never a missing/undefined value.
    for (const d of mix.days) for (const v of d.values) expect(typeof v).toBe("number");
  });
});
