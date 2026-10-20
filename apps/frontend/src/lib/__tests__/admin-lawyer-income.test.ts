// @vitest-environment node
// ============================================================
// LEGALIR — Lawyer income roll-up (settlement ledger, no fabrication)
// ============================================================
// The income figure on the admin lawyers table and the drawer's «درآمد» tab
// must be a sum of REAL settlement rows and nothing else. The distinctions
// that matter:
//   · PAID      → money actually paid out
//   · FAILED    → neither paid nor still owed (reported on its own)
//   · everything else (OPEN … APPROVED) → still outstanding
//   · no rows   → `hasData: false`, NEVER a zero that reads like a measured
//                 income. This is what keeps the UI honest.
//
// `@/lib/db` is replaced with an in-memory table store so the live `.data`
// directory is never touched.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  tables: new Map<string, unknown[]>(),
  users: new Map<string, unknown>(),
}));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: (id: string) => h.users.get(id),
  normalizeStoredMobile: (m: string) => m,
}));

import {
  listLawyerSettlements,
  summarizeLawyerIncome,
  summarizeLawyerIncomes,
} from "@/lib/admin/settlements";
import type { LawyerSettlement, SettlementLine, SettlementStatus } from "@legalir/types";

function line(net: number): SettlementLine {
  return {
    id: `line-${Math.random().toString(36).slice(2, 10)}`,
    settlementId: "stl-x",
    sourceType: "consultation",
    sourceId: "src-1",
    grossAmount: net,
    platformFee: 0,
    deductions: 0,
    netAmount: net,
    currency: "IRT",
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

let seq = 0;
function settlement(
  lawyerId: string,
  status: SettlementStatus,
  net: number,
  lineCount = 1
): LawyerSettlement {
  seq += 1;
  return {
    id: `stl-${lawyerId}-${seq}`,
    lawyerId,
    lawyerName: `وکیل ${lawyerId}`,
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T00:00:00.000Z",
    grossAmount: net,
    platformFee: 0,
    deductions: 0,
    netAmount: net,
    currency: "IRT",
    status,
    payoutDestinationMasked: null,
    payoutReference: null,
    requestedBy: null,
    approvedBy: null,
    paidAt: status === "PAID" ? "2026-04-02T00:00:00.000Z" : null,
    lines: Array.from({ length: lineCount }, () => line(net)),
    createdAt: `2026-03-${String(seq).padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: `2026-04-${String(seq).padStart(2, "0")}T00:00:00.000Z`,
  };
}

beforeEach(() => {
  h.tables.clear();
  h.users.clear();
  seq = 0;
});

describe("summarizeLawyerIncome", () => {
  it("splits PAID, FAILED and outstanding money into three buckets", () => {
    h.tables.set("lawyer_settlements", [
      settlement("lw-1", "PAID", 800_000),
      settlement("lw-1", "FAILED", 120_000),
      settlement("lw-1", "OPEN", 300_000),
      settlement("lw-1", "APPROVED", 200_000),
      settlement("lw-1", "REQUESTED", 90_000),
    ]);

    const income = summarizeLawyerIncome("lw-1");

    // Net earned is the sum of every row's net, settled or not.
    expect(income.netEarned).toBe(1_510_000);
    expect(income.grossEarned).toBe(1_510_000);
    expect(income.platformFee).toBe(0);
    expect(income.deductions).toBe(0);

    // PAID is out the door.
    expect(income.paidOut).toBe(800_000);
    // FAILED is reported separately — never folded into "still owed".
    expect(income.failedAmount).toBe(120_000);
    // OPEN + APPROVED + REQUESTED are still owed.
    expect(income.outstanding).toBe(590_000);
    // ...and the three buckets account for every Toman.
    expect(income.paidOut + income.failedAmount + income.outstanding).toBe(
      income.netEarned
    );

    expect(income.currency).toBe("IRT");
    expect(income.settlementCount).toBe(5);
    expect(income.lineCount).toBe(5);
    expect(income.hasData).toBe(true);
  });

  it("reports hasData:false for a lawyer with no settlement rows", () => {
    h.tables.set("lawyer_settlements", [settlement("lw-2", "PAID", 400_000)]);

    const income = summarizeLawyerIncome("lw-unknown");

    expect(income.hasData).toBe(false);
    expect(income.settlementCount).toBe(0);
    expect(income.lineCount).toBe(0);
    expect(income.netEarned).toBe(0);
    expect(income.outstanding).toBe(0);
    expect(income.paidOut).toBe(0);
  });

  it("sums lineCount across settlements rather than counting settlements", () => {
    h.tables.set("lawyer_settlements", [
      settlement("lw-3", "OPEN", 100_000, 3),
      settlement("lw-3", "PAID", 250_000, 2),
    ]);

    const income = summarizeLawyerIncome("lw-3");

    expect(income.settlementCount).toBe(2);
    expect(income.lineCount).toBe(5);
  });
});

describe("summarizeLawyerIncomes", () => {
  it("reads the ledger once and groups strictly by lawyer", () => {
    h.tables.set("lawyer_settlements", [
      settlement("lw-a", "PAID", 500_000),
      settlement("lw-b", "OPEN", 250_000),
      settlement("lw-a", "FAILED", 70_000),
      settlement("lw-c", "PAID", 900_000),
    ]);

    const all = summarizeLawyerIncomes(["lw-a", "lw-b", "lw-missing"]);

    expect(all.get("lw-a")!.paidOut).toBe(500_000);
    expect(all.get("lw-a")!.failedAmount).toBe(70_000);
    expect(all.get("lw-a")!.outstanding).toBe(0);
    expect(all.get("lw-a")!.settlementCount).toBe(2);

    expect(all.get("lw-b")!.outstanding).toBe(250_000);
    expect(all.get("lw-b")!.settlementCount).toBe(1);

    // Requested but never settled — the honest "no data" state.
    expect(all.get("lw-missing")!.hasData).toBe(false);

    // A lawyer that was not asked for is not in the result.
    expect(all.has("lw-c")).toBe(false);
  });

  it("returns an entry for every requested id, in request order", () => {
    h.tables.set("lawyer_settlements", []);

    const all = summarizeLawyerIncomes(["lw-2", "lw-1"]);

    expect([...all.keys()]).toEqual(["lw-2", "lw-1"]);
    expect(all.get("lw-2")!.hasData).toBe(false);
  });
});

describe("listLawyerSettlements", () => {
  it("returns only that lawyer's rows, newest first, capped by limit", () => {
    h.tables.set("lawyer_settlements", [
      settlement("lw-1", "PAID", 100),
      settlement("lw-2", "PAID", 200),
      settlement("lw-1", "OPEN", 300),
      settlement("lw-1", "FAILED", 400),
    ]);

    const rows = listLawyerSettlements("lw-1", 2);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.lawyerId === "lw-1")).toBe(true);
    // `listSettlements` sorts by updatedAt desc; our factory stamps it in
    // insertion order, so the last-row-latest invariant holds.
    expect(rows[0]!.netAmount).toBe(400);
    expect(rows[1]!.netAmount).toBe(300);
  });

  it("returns an empty list for a lawyer with no settlements", () => {
    h.tables.set("lawyer_settlements", [settlement("lw-2", "PAID", 100)]);

    expect(listLawyerSettlements("lw-1")).toEqual([]);
  });
});
