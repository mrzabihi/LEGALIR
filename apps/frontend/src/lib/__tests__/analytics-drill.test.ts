// ============================================================
// LEGALIR — Analytics: range-preserving drill-down (isolated temp DB)
// ============================================================
// The BI dashboard links a KPI to the operational list it summarised, carrying
// the SAME window so the opened rows reconcile to the number that was clicked.
// These tests lock the two load-bearing guarantees:
//   1. `resolveDrillWindow` prefers resolved ISO bounds; a bare preset
//      re-resolves against `now`; nothing → no window (the full ledger).
//   2. The drill readers filter by that window with the SAME half-open
//      (`>= from && < to`) semantics the KPIs use — so a boundary instant can
//      never fall on the wrong side, and an empty window yields ZERO rows
//      (never the whole table, which would silently mislead the operator).
//
// `db.ts` resolves `.data` from `process.cwd()` at import time, so every module
// is dynamically imported AFTER chdir into a throwaway directory — the real dev
// database is never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as drillModule from "../admin/analytics/drill";

type Db = typeof dbModule;
type Drill = typeof drillModule;

let db: Db;
let drill: Drill;
let tmpDir: string;
let originalCwd: string;

// Fixed join instants so no assertion depends on the wall clock.
const JAN = "2026-01-15T00:00:00.000Z";
const MAR = "2026-03-15T00:00:00.000Z";
const SEP = "2026-09-15T00:00:00.000Z";

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-drill-"));
  process.chdir(tmpDir);
  db = await import("../db");
  drill = await import("../admin/analytics/drill");

  // Three users, one at each controlled join instant. u-mar carries a staff
  // role so the role filter has something to exclude; u-jan/u-sep have an
  // active subscription so `hasActiveSubscription` is exercised both ways.
  db.writeTable("users", [
    {
      id: "u-jan",
      mobile: "09120000011",
      email: null,
      displayName: "کاربر ژانویه",
      role: "USER",
      platformAccountType: "PERSONAL",
      orgId: null,
      createdAt: JAN,
    },
    {
      id: "u-mar",
      mobile: "09120000012",
      email: null,
      displayName: "کاربر مارس",
      role: "ADMIN",
      platformAccountType: "PERSONAL",
      orgId: null,
      createdAt: MAR,
    },
    {
      id: "u-sep",
      mobile: "09120000013",
      email: null,
      displayName: "کاربر سپتامبر",
      role: "USER",
      platformAccountType: "PERSONAL",
      orgId: null,
      createdAt: SEP,
    },
  ]);

  // Two paid orders, one in January and one in September.
  db.writeTable("subscriptions", [
    {
      id: "sub-jan",
      user_id: "u-jan",
      plan_code: "silver",
      plan_name_fa: "نقره",
      amount: 1_000_000,
      currency: "IRT",
      status: "active",
      status_fa: "فعال",
      start_at: JAN,
      end_at: MAR,
      purchased_at: "2026-01-20T00:00:00.000Z",
      auto_renew: 0,
    },
    {
      id: "sub-sep",
      user_id: "u-sep",
      plan_code: "gold",
      plan_name_fa: "طلا",
      amount: 2_000_000,
      currency: "IRT",
      status: "active",
      status_fa: "فعال",
      start_at: SEP,
      end_at: SEP,
      purchased_at: "2026-09-20T00:00:00.000Z",
      auto_renew: 0,
    },
  ]);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// resolveDrillWindow — ISO wins, preset re-resolves, nothing → no window
// ============================================================

describe("resolveDrillWindow", () => {
  it("prefers resolved ISO bounds and derives the previous window", () => {
    const w = drill.resolveDrillWindow({
      fromIso: "2026-01-01T00:00:00.000Z",
      toIso: "2026-02-01T00:00:00.000Z",
    });
    expect(w).not.toBeNull();
    expect(w!.fromIso).toBe("2026-01-01T00:00:00.000Z");
    expect(w!.toIso).toBe("2026-02-01T00:00:00.000Z");
    expect(w!.preset).toBe("custom");
    expect(w!.rangeDays).toBe(31);
    // Prev window is the equally-long span immediately before the current one.
    expect(w!.prevToIso).toBe("2026-01-01T00:00:00.000Z");
    expect(w!.prevFromIso).toBe("2025-12-01T00:00:00.000Z");
  });

  it("re-resolves a bare preset against `now`", () => {
    const w = drill.resolveDrillWindow({ preset: "30d", now: new Date("2026-06-01T00:00:00.000Z") });
    expect(w).not.toBeNull();
    expect(new Date(w!.fromIso).getTime()).toBeLessThan(new Date(w!.toIso).getTime());
  });

  it("returns null when neither ISO bounds nor a preset is supplied", () => {
    expect(drill.resolveDrillWindow({})).toBeNull();
  });
});

// ============================================================
// listDrillUsers — filters by ACCOUNT-CREATED instant
// ============================================================

describe("listDrillUsers", () => {
  const janWindow = { fromIso: "2026-01-01T00:00:00.000Z", toIso: "2026-02-01T00:00:00.000Z" };

  it("returns every user when there is no window", () => {
    const res = drill.listDrillUsers(null, { pageSize: 100 });
    expect(res.total).toBe(3);
    expect(res.items).toHaveLength(3);
  });

  it("keeps only users created inside the window", () => {
    const res = drill.listDrillUsers(drill.resolveDrillWindow(janWindow)!, { pageSize: 100 });
    expect(res.total).toBe(1);
    expect(res.items.map((r) => r.id)).toEqual(["u-jan"]);
  });

  it("yields ZERO rows for an empty window, never the whole table", () => {
    const empty = drill.resolveDrillWindow({
      fromIso: "2020-01-01T00:00:00.000Z",
      toIso: "2020-02-01T00:00:00.000Z",
    })!;
    const res = drill.listDrillUsers(empty, { pageSize: 100 });
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it("is half-open at both boundaries: `from` inclusive, `to` exclusive", () => {
    // [JAN, MAR) includes u-jan (createdAt === from) but excludes u-mar
    // (createdAt === to).
    const res = drill.listDrillUsers(
      drill.resolveDrillWindow({ fromIso: JAN, toIso: MAR })!,
      { pageSize: 100 }
    );
    expect(res.items.map((r) => r.id)).toEqual(["u-jan"]);
  });

  it("sorts newest-first by default and oldest-first on request", () => {
    const recent = drill.listDrillUsers(null, { pageSize: 100 });
    expect(recent.items[0]!.id).toBe("u-sep");
    const oldest = drill.listDrillUsers(null, { sort: "oldest", pageSize: 100 });
    expect(oldest.items[0]!.id).toBe("u-jan");
  });

  it("applies the role filter on top of the window", () => {
    const admins = drill.listDrillUsers(null, { role: "ADMIN", pageSize: 100 });
    expect(admins.items.map((r) => r.id)).toEqual(["u-mar"]);
  });

  it("reports active-subscription state per user", () => {
    const res = drill.listDrillUsers(null, { pageSize: 100 });
    const byId = new Map(res.items.map((r) => [r.id, r.hasActiveSubscription]));
    expect(byId.get("u-jan")).toBe(true);
    expect(byId.get("u-sep")).toBe(true);
    expect(byId.get("u-mar")).toBe(false);
  });

  it("paginates without changing the total", () => {
    const res = drill.listDrillUsers(null, { page: 2, pageSize: 1 });
    expect(res.total).toBe(3);
    expect(res.page).toBe(2);
    expect(res.items).toHaveLength(1);
  });
});

// ============================================================
// listDrillOrders — filters by PURCHASE instant, via the same listOrders
// ============================================================

describe("listDrillOrders", () => {
  it("returns the full ledger when there is no window", () => {
    const res = drill.listDrillOrders(null, { pageSize: 100 });
    expect(res.total).toBe(2);
  });

  it("keeps only orders purchased inside the window", () => {
    const res = drill.listDrillOrders(
      drill.resolveDrillWindow({ fromIso: "2026-01-01T00:00:00.000Z", toIso: "2026-02-01T00:00:00.000Z" })!,
      { pageSize: 100 }
    );
    expect(res.total).toBe(1);
    expect(res.items[0]!.id).toBe("sub-jan");
  });

  it("yields ZERO rows for an empty window", () => {
    const empty = drill.resolveDrillWindow({
      fromIso: "2020-01-01T00:00:00.000Z",
      toIso: "2020-02-01T00:00:00.000Z",
    })!;
    expect(drill.listDrillOrders(empty, { pageSize: 100 }).total).toBe(0);
  });

  it("is half-open: an order at `to` is excluded, one at `from` is included", () => {
    const res = drill.listDrillOrders(
      drill.resolveDrillWindow({
        fromIso: "2026-01-20T00:00:00.000Z",
        toIso: "2026-09-20T00:00:00.000Z",
      })!,
      { pageSize: 100 }
    );
    // sub-jan purchased exactly at `from` → included; sub-sep at `to` → excluded.
    expect(res.items.map((o) => o.id)).toEqual(["sub-jan"]);
  });
});
