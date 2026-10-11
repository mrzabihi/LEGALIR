// ============================================================
// LEGALIR — Admin coupon management (presentation + parsing layer)
// ============================================================
// A thin admin layer over `lib/coupons/store`: it never re-implements discount
// math or validation (those live in pricing/quote + coupons/validate), it only
// shapes the read model an operator needs and narrows the request body into a
// validated `CouponDraft`.
//
// Rule enforcement of eligibility, capacity and window is done SERVER-SIDE at
// validation time (coupons/validate). This layer's job is to keep the catalog
// coherent (unique codes, sane fields) and to expose usage counts for reporting.
// ============================================================

import { listCoupons, getCouponById, countUsages, type CouponDraft } from "@/lib/coupons/store";
import type { Coupon, CouponKind, CouponStatus } from "@legalir/types";

export interface AdminCouponRow extends Coupon {
  /** Definitive consumptions so far (recomputed, never trusted from the row). */
  usageCount: number;
}

/** Every coupon with its live usage count, newest first. */
export function listAdminCoupons(): AdminCouponRow[] {
  return listCoupons().map((c) => ({ ...c, usageCount: countUsages(c.id) }));
}

export function getAdminCoupon(id: string): AdminCouponRow | null {
  const c = getCouponById(id);
  return c ? { ...c, usageCount: countUsages(c.id) } : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Narrow a raw admin body to a `CouponDraft`. Missing fields take safe
 * defaults so an edit form only needs to send what it changed; the store then
 * validates the result.
 */
export function parseCouponDraft(body: Record<string, unknown>): CouponDraft {
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  return {
    title: typeof body["title"] === "string" ? body["title"] : "",
    code: typeof body["code"] === "string" ? body["code"] : "",
    kind: (body["kind"] === "fixed" ? "fixed" : "percent") as CouponKind,
    value: asNum(body["value"], 0),
    percentCap: asNum(body["percentCap"], 100),
    eligiblePlans: asStringArray(body["eligiblePlans"]),
    startsAt: typeof body["startsAt"] === "string" ? body["startsAt"] : now.toISOString(),
    endsAt: typeof body["endsAt"] === "string" ? body["endsAt"] : defaultEnd,
    minOrderAmount: asNum(body["minOrderAmount"], 0),
    totalUses: asInt(body["totalUses"], 0),
    perUserLimit: asInt(body["perUserLimit"], 0),
    status: (["active", "disabled", "archived"].includes(String(body["status"]))
      ? body["status"]
      : "active") as CouponStatus,
    internalNotes: typeof body["internalNotes"] === "string" ? body["internalNotes"] : "",
    currency: typeof body["currency"] === "string" ? body["currency"] : "IRT",
  };
}
