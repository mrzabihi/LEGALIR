// ============================================================
// LEGALIR — Admin panel invariants (RBAC · money · audit)
// ============================================================
// Companion to authorization.test.ts. That suite proves ordinary users
// cannot reach each other's data. This suite proves the ADMIN surface's own
// invariants, which the product spec calls out explicitly:
//   • the role → permission matrix enforces separation of duties,
//   • commission rules are versioned — history is never mutated,
//   • settlements obey their state machine and the second-approver rule,
//   • refunds require a second, DIFFERENT approver,
//   • the audit trail redacts secrets before it is written,
//   • the last super-admin can never be demoted (lockout guard).
//
// The data layer (`@/lib/db`) is replaced with an in-memory table store that
// clones on read AND write, mirroring the file-backed store's independence
// between calls (a function reads rows, mutates, then writes the whole table).
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted so the vi.mock factory (itself hoisted) can close over it.
const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: (id: string) =>
    (h.tables.get("users") as Array<Record<string, unknown>> | undefined)?.find(
      (u) => u["id"] === id
    ),
  setUserRole: (id: string, role: string) => {
    const users = structuredClone(
      (h.tables.get("users") ?? []) as Array<Record<string, unknown>>
    );
    const u = users.find((x) => x["id"] === id);
    if (!u) return undefined;
    u["role"] = role;
    h.tables.set("users", structuredClone(users));
    return u;
  },
  normalizeStoredMobile: (m: string) => m,
  getAccountType: () => "individual",
}));

import {
  roleHasPermission,
  canAccessAdminPanel,
  STAFF_ROLES,
  PLATFORM_SUPERADMIN_ROLES,
  type PlatformRole,
  type Permission,
  type CommissionRule,
  type LawyerSettlement,
  type AdjustmentKind,
} from "@legalir/types";

import {
  listCommissionRules,
  updateCommissionRule,
  effectiveRuleFor,
  computePlatformFee,
  createSettlement,
  addSettlementLine,
  transitionSettlement,
  canTransition,
  maskPayoutDestination,
} from "@/lib/admin/settlements";
import { getOrder, createAdjustment, decideAdjustment } from "@/lib/admin/orders";
import { redactForAudit, recordAudit, listAudit } from "@/lib/admin/audit";
import { listStaff, changeUserRole, listRoles } from "@/lib/admin/staff";

beforeEach(() => {
  h.tables.clear();
});

/** Every permission key, harvested for the "ordinary users hold none" sweep. */
const ALL_PERMISSIONS: Permission[] = [
  "case:read:own",
  "admin:overview:read",
  "admin:users:read",
  "admin:users:manage",
  "admin:lawyer:verify",
  "admin:knowledge:read",
  "admin:knowledge:write",
  "admin:audit:read",
  "admin:system:manage",
  "admin:requests:read",
  "admin:requests:manage",
  "admin:lawyer:read",
  "admin:services:read",
  "admin:services:manage",
  "admin:flags:manage",
  "admin:plans:read",
  "admin:plans:manage",
  "admin:billing:read",
  "admin:billing:manage",
  "admin:refund:approve",
  "admin:finance:read",
  "admin:finance:manage",
  "admin:settlement:manage",
  "admin:settlement:approve",
  "admin:ai:read",
  "admin:ai:manage",
  "admin:ai:secret",
  "admin:rag:read",
  "admin:rag:manage",
  "admin:rag:publish",
  "admin:calculators:read",
  "admin:calculators:manage",
  "admin:support:read",
  "admin:support:manage",
  "admin:content:read",
  "admin:content:manage",
  "admin:reports:read",
  "admin:reports:export",
  "admin:staff:read",
  "admin:staff:manage",
  "admin:settings:read",
  "admin:settings:manage",
];

// ---------------------------------------------------------------------------
// RBAC — role → permission matrix & separation of duties
// ---------------------------------------------------------------------------

describe("admin RBAC matrix", () => {
  it("gates the admin panel to staff roles only", () => {
    for (const role of STAFF_ROLES) {
      expect(canAccessAdminPanel(role), `${role} should reach the panel`).toBe(true);
    }
    for (const role of ["USER", "LAWYER", "COMPANY_OWNER", "COMPANY_ADMIN", "COMPANY_MEMBER"] as PlatformRole[]) {
      expect(canAccessAdminPanel(role), `${role} must NOT reach the panel`).toBe(false);
    }
  });

  it("grants no admin permission to ordinary users", () => {
    const adminPerms = ALL_PERMISSIONS.filter((p) => p.startsWith("admin:"));
    for (const role of ["USER", "LAWYER", "COMPANY_OWNER"] as PlatformRole[]) {
      for (const perm of adminPerms) {
        expect(roleHasPermission(role, perm), `${role} must not hold ${perm}`).toBe(false);
      }
    }
  });

  it("separates financial approval from staff management", () => {
    // Only the SUPER_ADMIN may change roles; a finance approver must not.
    expect(roleHasPermission("SUPER_ADMIN", "admin:staff:manage")).toBe(true);
    expect(roleHasPermission("ADMIN_FINANCE", "admin:staff:manage")).toBe(false);
    expect(roleHasPermission("ADMIN", "admin:staff:manage")).toBe(false);

    // The only role that is BOTH the money approver and the staff manager.
    const both = STAFF_ROLES.filter(
      (r) => roleHasPermission(r, "admin:staff:manage") && roleHasPermission(r, "admin:refund:approve")
    );
    expect(both).toEqual(["SUPER_ADMIN"]);
  });

  it("keeps super-admin-only powers exclusive", () => {
    const superOnly: Permission[] = [
      "admin:system:manage",
      "admin:staff:manage",
      "admin:settings:manage",
    ];
    for (const perm of superOnly) {
      const holders = STAFF_ROLES.filter((r) => roleHasPermission(r, perm));
      expect(holders, `${perm} must be super-admin only`).toEqual(["SUPER_ADMIN"]);
    }
  });

  it("scopes support, AI and lawyer roles to their own sections", () => {
    expect(roleHasPermission("SUPPORT", "admin:support:manage")).toBe(true);
    expect(roleHasPermission("SUPPORT", "admin:billing:read")).toBe(false);
    expect(roleHasPermission("SUPPORT", "admin:users:manage")).toBe(false);

    expect(roleHasPermission("ADMIN_AI", "admin:ai:secret")).toBe(true);
    expect(roleHasPermission("ADMIN_AI", "admin:billing:manage")).toBe(false);
    // A platform ADMIN does NOT get the raw-secret power — that is AI-team only.
    expect(roleHasPermission("ADMIN", "admin:ai:secret")).toBe(false);

    expect(roleHasPermission("ADMIN_LAWYERS", "admin:lawyer:verify")).toBe(true);
    expect(roleHasPermission("ADMIN_LAWYERS", "admin:settlement:approve")).toBe(false);
  });

  it("anchors role management on exactly one role", () => {
    // SUPER_ADMIN is the vendor-side role; ADMIN is a broad operator but is
    // NOT permitted to manage staff. This distinction is load-bearing for the
    // lockout guard, so it is asserted here rather than assumed.
    const managers = STAFF_ROLES.filter((r) => roleHasPermission(r, "admin:staff:manage"));
    expect(managers).toEqual(["SUPER_ADMIN"]);
    expect(PLATFORM_SUPERADMIN_ROLES).toContain("ADMIN");
    expect(roleHasPermission("ADMIN", "admin:system:manage")).toBe(false);
    expect(roleHasPermission("SUPER_ADMIN", "admin:system:manage")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Commission rules — versioned, append-only
// ---------------------------------------------------------------------------

describe("commission rules", () => {
  it("seeds a default rule on first read", () => {
    const rules = listCommissionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.serviceType).toBe("consultation");
    expect(rules[0]!.version).toBe(1);
  });

  it("appends a new version and closes the previous one", () => {
    listCommissionRules(); // seed v1
    const res = updateCommissionRule({
      serviceType: "consultation",
      platformPercent: 15,
      platformFixedToman: 5000,
      allowedDeductions: ["gateway_fee"],
      changedBy: "admin-1",
    });
    expect("error" in res).toBe(false);
    const v2 = res as CommissionRule;
    expect(v2.version).toBe(2);

    // History is never mutated: v1 still exists, now closed.
    const rows = listCommissionRules();
    const v1 = rows.find((r) => r.version === 1)!;
    expect(v1.validTo).not.toBeNull();
    expect(rows).toHaveLength(2);
  });

  it("computes integer Toman fees from the active rule", () => {
    const rule: CommissionRule = {
      id: "r",
      serviceType: "consultation",
      platformPercent: 15,
      platformFixedToman: 5000,
      allowedDeductions: [],
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(computePlatformFee(100_000, rule)).toBe(20_000);
    expect(Number.isInteger(computePlatformFee(33_333, rule))).toBe(true);
  });

  it("resolves the rule in force at a given instant", () => {
    h.tables.set("commission_rules", [
      { id: "a", serviceType: "x", platformPercent: 10, platformFixedToman: 0, allowedDeductions: [], validFrom: "2026-01-01T00:00:00.000Z", validTo: "2026-06-01T00:00:00.000Z", version: 1, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", serviceType: "x", platformPercent: 30, platformFixedToman: 0, allowedDeductions: [], validFrom: "2026-06-01T00:00:00.000Z", validTo: null, version: 2, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(effectiveRuleFor("x", "2026-03-01T00:00:00.000Z")!.id).toBe("a");
    expect(effectiveRuleFor("x", "2026-07-01T00:00:00.000Z")!.id).toBe("b");
    expect(effectiveRuleFor("x", "2025-12-01T00:00:00.000Z")).toBeUndefined();
  });

  it("rejects out-of-range commission values", () => {
    expect(updateCommissionRule({ serviceType: "consultation", platformPercent: 150, platformFixedToman: 0, allowedDeductions: [], changedBy: "a" })).toEqual({ error: "INVALID_PERCENT" });
    expect(updateCommissionRule({ serviceType: "consultation", platformPercent: -1, platformFixedToman: 0, allowedDeductions: [], changedBy: "a" })).toEqual({ error: "INVALID_PERCENT" });
    expect(updateCommissionRule({ serviceType: "consultation", platformPercent: 10, platformFixedToman: -1, allowedDeductions: [], changedBy: "a" })).toEqual({ error: "INVALID_FEE" });
  });
});

// ---------------------------------------------------------------------------
// Settlements — state machine + second approver
// ---------------------------------------------------------------------------

describe("lawyer settlements", () => {
  const openSettlement = (): LawyerSettlement => {
    const res = createSettlement({
      lawyerId: "law-1",
      lawyerName: "وکیل تست",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      createdBy: "u-a",
    });
    return res as LawyerSettlement;
  };

  it("mirrors the shared transitions table", () => {
    expect(canTransition("OPEN", "INVOICED")).toBe(true);
    expect(canTransition("OPEN", "PAID")).toBe(false);
    expect(canTransition("PAID", "OPEN")).toBe(false);
    expect(canTransition("UNDER_REVIEW", "APPROVED")).toBe(true);
  });

  it("opens with zero lines rather than a fabricated amount", () => {
    const s = openSettlement();
    expect(s.status).toBe("OPEN");
    expect(s.lines).toHaveLength(0);
    expect(s.netAmount).toBe(0);
  });

  it("validates the lawyer and the period", () => {
    expect(createSettlement({ lawyerId: "", lawyerName: "", periodStart: "2026-09-01", periodEnd: "2026-09-30", createdBy: "a" })).toEqual({ error: "LAWYER_REQUIRED" });
    expect(createSettlement({ lawyerId: "l", lawyerName: "n", periodStart: "2026-09-30", periodEnd: "2026-09-01", createdBy: "a" })).toEqual({ error: "INVALID_PERIOD" });
  });

  it("derives a line's fee from the active rule", () => {
    listCommissionRules(); // seed consultation @20%
    const s = openSettlement();
    const res = addSettlementLine({ settlementId: s.id, sourceType: "consultation", sourceId: "req-1", grossAmount: 100_000, serviceType: "consultation" });
    expect("error" in res).toBe(false);
    const updated = res as LawyerSettlement;
    expect(updated.grossAmount).toBe(100_000);
    expect(updated.platformFee).toBe(20_000);
    expect(updated.netAmount).toBe(80_000);
  });

  it("locks lines once the settlement leaves OPEN", () => {
    listCommissionRules();
    const s = openSettlement();
    transitionSettlement({ settlementId: s.id, to: "INVOICED", actorUserId: "u-a" });
    expect(addSettlementLine({ settlementId: s.id, sourceType: "consultation", sourceId: "x", grossAmount: 1000, serviceType: "consultation" })).toEqual({ error: "LOCKED" });
  });

  it("requires a second, different approver", () => {
    const s = openSettlement();
    transitionSettlement({ settlementId: s.id, to: "REQUESTED", actorUserId: "u-a" });
    transitionSettlement({ settlementId: s.id, to: "UNDER_REVIEW", actorUserId: "u-b" });
    const denied = transitionSettlement({ settlementId: s.id, to: "APPROVED", actorUserId: "u-a" });
    expect("error" in denied && denied.error).toBe("SECOND_APPROVER_REQUIRED");
    const approved = transitionSettlement({ settlementId: s.id, to: "APPROVED", actorUserId: "u-b" }) as LawyerSettlement;
    expect(approved.approvedBy).toBe("u-b");
  });

  it("refuses to pay a settlement that was never approved", () => {
    // A defensive guard: seed a row whose state and approver disagree.
    h.tables.set("lawyer_settlements", [
      { id: "stl-x", lawyerId: "law-1", lawyerName: "و", periodStart: "2026-09-01", periodEnd: "2026-09-30", grossAmount: 0, platformFee: 0, deductions: 0, netAmount: 0, currency: "IRT", status: "APPROVED", payoutDestinationMasked: null, payoutReference: null, requestedBy: "u-a", approvedBy: null, paidAt: null, lines: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(transitionSettlement({ settlementId: "stl-x", to: "PAID", actorUserId: "u-c" })).toEqual({ error: "NOT_APPROVED" });
  });

  it("records a masked destination on payment and then is terminal", () => {
    const s = openSettlement();
    transitionSettlement({ settlementId: s.id, to: "REQUESTED", actorUserId: "u-a" });
    transitionSettlement({ settlementId: s.id, to: "UNDER_REVIEW", actorUserId: "u-b" });
    transitionSettlement({ settlementId: s.id, to: "APPROVED", actorUserId: "u-b" });
    const paid = transitionSettlement({
      settlementId: s.id,
      to: "PAID",
      actorUserId: "u-c",
      payoutDestinationMasked: maskPayoutDestination("IR820540102680020817909002"),
      payoutReference: "REF-1",
    }) as LawyerSettlement;
    expect(paid.status).toBe("PAID");
    expect(paid.payoutDestinationMasked).toBe("••••9002");
    expect(paid.paidAt).not.toBeNull();
    // Terminal: no further move is allowed.
    expect(transitionSettlement({ settlementId: s.id, to: "OPEN", actorUserId: "u-c" })).toEqual({ error: "INVALID_TRANSITION" });
  });

  it("rejects an illegal jump", () => {
    const s = openSettlement();
    expect(transitionSettlement({ settlementId: s.id, to: "PAID", actorUserId: "u-a" })).toEqual({ error: "INVALID_TRANSITION" });
  });

  it("never exposes a raw payout destination", () => {
    expect(maskPayoutDestination("IR820540102680020817909002")).toBe("••••9002");
    expect(maskPayoutDestination("1234")).toBe("••••");
    expect(maskPayoutDestination(" 6037 9911 2233 4455 ")).toBe("••••4455");
  });
});

// ---------------------------------------------------------------------------
// Refunds / adjustments — two-person approval
// ---------------------------------------------------------------------------

describe("financial adjustments", () => {
  const seedOrder = () => {
    h.tables.set("users", [
      { id: "u-1", mobile: "09121234567", displayName: "کاربر تست", email: null, passwordHash: "x", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    h.tables.set("subscriptions", [
      { id: "sub-1", user_id: "u-1", plan_code: "pro", plan_name_fa: "حرفه‌ای", amount: 500_000, currency: "IRT", status: "active", status_fa: "فعال", start_at: "2026-01-01", end_at: "2027-01-01", purchased_at: "2026-01-01T00:00:00.000Z", auto_renew: 0 },
    ]);
  };

  it("derives an order from the real subscription and masks the mobile", () => {
    seedOrder();
    const order = getOrder("sub-1")!;
    expect(order.status).toBe("SUCCESS");
    expect(order.netAmount).toBe(500_000);
    expect(order.userMobileMasked).toBe("0912•••4567");
    expect(order.gateway).toBe("simulated");
  });

  it("holds a refund in `pending` and requires a different approver", () => {
    seedOrder();
    const kind: AdjustmentKind = "refund_partial";
    const created = createAdjustment({ orderId: "sub-1", kind, amount: 100_000, reason: "درخواست مشتری", requestedBy: "u-a" });
    expect("error" in created).toBe(false);
    const adj = created as { id: string; status: string };
    expect(adj.status).toBe("pending");

    expect(decideAdjustment(adj.id, "approved", "u-a")).toEqual({ error: "SECOND_APPROVER_REQUIRED" });
    const done = decideAdjustment(adj.id, "approved", "u-b") as { status: string; approvedBy: string };
    expect(done.status).toBe("completed");
    expect(done.approvedBy).toBe("u-b");

    // The order now reflects the completed refund.
    const order = getOrder("sub-1")!;
    expect(order.refundedAmount).toBe(100_000);
    expect(order.netAmount).toBe(400_000);
    expect(order.status).toBe("PARTIALLY_REFUNDED");
  });

  it("cannot decide the same adjustment twice", () => {
    seedOrder();
    const adj = createAdjustment({ orderId: "sub-1", kind: "refund_partial", amount: 100_000, reason: "دلیل", requestedBy: "u-a" }) as { id: string };
    decideAdjustment(adj.id, "approved", "u-b");
    expect(decideAdjustment(adj.id, "approved", "u-c")).toEqual({ error: "ALREADY_DECIDED" });
  });

  it("never refunds more than the order total", () => {
    seedOrder();
    const a = createAdjustment({ orderId: "sub-1", kind: "refund_partial", amount: 100_000, reason: "دلیل", requestedBy: "u-a" }) as { id: string };
    decideAdjustment(a.id, "approved", "u-b");
    expect(createAdjustment({ orderId: "sub-1", kind: "refund_partial", amount: 500_000, reason: "دلیل", requestedBy: "u-a" })).toEqual({ error: "EXCEEDS_ORDER" });
  });

  it("requires a reason and a real order", () => {
    seedOrder();
    expect(createAdjustment({ orderId: "sub-1", kind: "refund_partial", amount: 1000, reason: "ab", requestedBy: "u-a" })).toEqual({ error: "REASON_REQUIRED" });
    expect(createAdjustment({ orderId: "missing", kind: "refund_partial", amount: 1000, reason: "دلیل", requestedBy: "u-a" })).toEqual({ error: "ORDER_NOT_FOUND" });
    expect(createAdjustment({ orderId: "sub-1", kind: "refund_partial", amount: 0, reason: "دلیل", requestedBy: "u-a" })).toEqual({ error: "INVALID_AMOUNT" });
  });
});

// ---------------------------------------------------------------------------
// Audit trail — redaction is mandatory
// ---------------------------------------------------------------------------

describe("admin audit trail", () => {
  it("redacts secrets and caps long values, recursively", () => {
    const out = redactForAudit({
      password: "hunter2",
      otp: "405405",
      API_KEY: "sk-live-123",
      nested: { token: "abc", keep: "v" },
      long: "a".repeat(600),
      arr: ["x", "y"],
    })!;
    expect(out["password"]).toBe("[redacted]");
    expect(out["otp"]).toBe("[redacted]");
    expect(out["API_KEY"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["token"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["keep"]).toBe("v");
    expect(String(out["long"]).length).toBe(501); // 500 chars + ellipsis
    expect(out["arr"]).toEqual(["x", "y"]);
    expect(redactForAudit(null)).toBeNull();
  });

  it("never writes a raw secret into the stored entry", () => {
    const entry = recordAudit({
      actorUserId: "u-a",
      actorRole: "ADMIN",
      action: "ai.provider.save",
      resourceType: "ai_provider",
      resourceId: "p1",
      before: null,
      after: { nameFa: "OpenAI", apiKey: "sk-secret", keyHint: "••••abcd" },
    });
    expect(entry.after!["apiKey"]).toBe("[redacted]");
    expect(entry.after!["keyHint"]).toBe("••••abcd");
    // The serialized row contains no trace of the raw key.
    expect(JSON.stringify(entry)).not.toContain("sk-secret");
  });

  it("filters and paginates the append-only log", () => {
    for (let i = 0; i < 3; i++) {
      recordAudit({ actorUserId: "u-a", actorRole: "ADMIN", action: "flag.update", resourceType: "feature_flag", resourceId: `f-${i}`, result: "success" });
    }
    recordAudit({ actorUserId: "u-b", actorRole: "ADMIN_FINANCE", action: "refund.decide", resourceType: "adjustment", resourceId: "adj-1", result: "denied" });

    const denied = listAudit({ result: "denied" });
    expect(denied.total).toBe(1);
    expect(denied.items[0]!.action).toBe("refund.decide");

    const byActor = listAudit({ actorUserId: "u-a" });
    expect(byActor.total).toBe(3);

    const page = listAudit({ page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Staff & roles — lockout guard
// ---------------------------------------------------------------------------

describe("staff administration", () => {
  const seedStaff = () => {
    h.tables.set("users", [
      { id: "u-super", mobile: "09120000001", displayName: null, email: null, passwordHash: "x", role: "SUPER_ADMIN", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "u-user", mobile: "09120000002", displayName: "کاربر عادی", email: null, passwordHash: "x", role: "USER", createdAt: "2026-01-02T00:00:00.000Z" },
    ]);
  };

  it("lists only staff and masks mobiles", () => {
    seedStaff();
    const staff = listStaff();
    expect(staff.map((s) => s.id)).toEqual(["u-super"]);
    expect(staff[0]!.mobileMasked).toBe("0912•••0001");
    expect(staff[0]!.roleFa).toBe("مدیر ارشد پلتفرم");
  });

  it("refuses to demote the last super-admin", () => {
    seedStaff();
    expect(changeUserRole({ userId: "u-super", role: "USER", actorUserId: "u-super" })).toEqual({ error: "LAST_SUPERADMIN" });
  });

  it("allows demotion while another role-manager remains, then locks again", () => {
    seedStaff();
    h.tables.set("users", [
      ...(h.tables.get("users") as Array<Record<string, unknown>>),
      { id: "u-super2", mobile: "09120000003", displayName: null, email: null, passwordHash: "x", role: "SUPER_ADMIN", createdAt: "2026-01-03T00:00:00.000Z" },
    ]);
    const demoted = changeUserRole({ userId: "u-super", role: "USER", actorUserId: "u-super2" });
    expect("error" in demoted).toBe(false);
    expect((demoted as { role: PlatformRole }).role).toBe("USER");

    // Only one role-manager remains → it can no longer be demoted.
    expect(changeUserRole({ userId: "u-super2", role: "USER", actorUserId: "u-super2" })).toEqual({ error: "LAST_SUPERADMIN" });
  });

  it("does not treat ADMIN as a role-manager (lockout-hole regression)", () => {
    // A platform ADMIN can operate but cannot manage roles. If it were counted
    // as a lockout anchor, demoting the only SUPER_ADMIN would strip the
    // platform of ALL role management. The guard must refuse precisely that.
    seedStaff();
    h.tables.set("users", [
      ...(h.tables.get("users") as Array<Record<string, unknown>>),
      { id: "u-admin", mobile: "09120000003", displayName: null, email: null, passwordHash: "x", role: "ADMIN", createdAt: "2026-01-03T00:00:00.000Z" },
    ]);
    expect(changeUserRole({ userId: "u-super", role: "USER", actorUserId: "u-admin" })).toEqual({ error: "LAST_SUPERADMIN" });

    // ADMIN → SUPER_ADMIN is a promotion: two managers now, so demotion is safe.
    expect("error" in changeUserRole({ userId: "u-admin", role: "SUPER_ADMIN", actorUserId: "u-super" })).toBe(false);
    expect("error" in changeUserRole({ userId: "u-super", role: "USER", actorUserId: "u-admin" })).toBe(false);
  });

  it("404s an unknown target", () => {
    seedStaff();
    expect(changeUserRole({ userId: "ghost", role: "USER", actorUserId: "u-super" })).toEqual({ error: "USER_NOT_FOUND" });
  });

  it("describes every role for the permission matrix page", () => {
    const roles = listRoles();
    const superAdmin = roles.find((r) => r.role === "SUPER_ADMIN")!;
    expect(superAdmin.isSuperAdmin).toBe(true);
    expect(superAdmin.isStaff).toBe(true);
    const user = roles.find((r) => r.role === "USER")!;
    expect(user.isStaff).toBe(false);
    expect(user.isSuperAdmin).toBe(false);
    for (const role of STAFF_ROLES) {
      expect(roles.find((r) => r.role === role)!.isStaff).toBe(true);
    }
  });
});
