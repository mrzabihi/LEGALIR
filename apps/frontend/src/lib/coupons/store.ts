// ============================================================
// LEGALIR — Coupon store (server-only, JSON table)
// ============================================================
// Two tables:
//   coupons        — the catalog (one row per coupon, never physically deleted)
//   coupon_usages  — one row per DEFINITIVE consumption (audit-grade trail)
//
// The code is NORMALIZED (trim + upper-case) on every write AND every lookup,
// so `sale10`, ` SALE10 ` and `Sale10` all resolve to the same coupon and can
// never coexist as duplicates. Uniqueness is enforced here under the same
// in-process mutex that guards order commits (the JSON store has no DB
// constraint, so the invariant lives in this single writer).
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import type { Coupon, CouponKind, CouponStatus, CouponUsage } from "@legalir/types";

const COUPONS = "coupons";
const USAGES = "coupon_usages";

/** The canonical form of a redemption code: trimmed, upper-cased, no spaces. */
export function normalizeCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase();
}

function readCoupons(): Coupon[] {
  return readTable<Coupon>(COUPONS);
}
function writeCoupons(rows: Coupon[]): void {
  writeTable(COUPONS, rows);
}
function readUsages(): CouponUsage[] {
  return readTable<CouponUsage>(USAGES);
}
function writeUsages(rows: CouponUsage[]): void {
  writeTable(USAGES, rows);
}

export function listCoupons(): Coupon[] {
  return readCoupons().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCouponById(id: string): Coupon | null {
  return readCoupons().find((c) => c.id === id) ?? null;
}

/** Look up by normalized code. `null` when unknown. */
export function getCouponByCode(rawCode: string): Coupon | null {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  return readCoupons().find((c) => c.code === code) ?? null;
}

/** True when a normalized code already exists (optionally excluding one id). */
export function codeExists(rawCode: string, excludeId?: string): boolean {
  const code = normalizeCode(rawCode);
  return readCoupons().some((c) => c.code === code && c.id !== excludeId);
}

// ============================================================
// Usage counting (the definitive-consumption ledger)
// ============================================================

/** Total definitive consumptions of a coupon (all users). */
export function countUsages(couponId: string): number {
  return readUsages().filter((u) => u.couponId === couponId).length;
}

/** Definitive consumptions of a coupon by one user (per-user limit check). */
export function countUserUsages(couponId: string, userId: string): number {
  return readUsages().filter((u) => u.couponId === couponId && u.userId === userId).length;
}

/** True when this order already consumed a coupon (idempotency guard). */
export function usageExistsForOrder(orderId: string): boolean {
  return readUsages().some((u) => u.orderId === orderId);
}

/**
 * Record a definitive consumption. Idempotent per (orderId): a replayed commit
 * never writes a second row, so a coupon can never be "used twice" by one order.
 * Returns the usage row (existing or new). Does NOT recompute capacity — the
 * caller must have already validated under the same mutex.
 */
export function recordUsage(
  usage: Omit<CouponUsage, "id" | "consumedAt">,
  now: Date = new Date()
): CouponUsage {
  const rows = readUsages();
  const existing = rows.find((u) => u.orderId === usage.orderId);
  if (existing) return existing;

  const row: CouponUsage = {
    ...usage,
    id: `cu-${crypto.randomUUID()}`,
    consumedAt: now.toISOString(),
  };
  rows.push(row);
  writeUsages(rows);

  // Keep the denormalised counter in step for fast reporting.
  const coupons = readCoupons();
  const coupon = coupons.find((c) => c.id === usage.couponId);
  if (coupon) {
    coupon.usedCount = countUsages(usage.couponId);
    coupon.updatedAt = now.toISOString();
    writeCoupons(coupons);
  }
  return row;
}

// ============================================================
// Writes (admin)
// ============================================================

export interface CouponDraft {
  title: string;
  code: string;
  kind: CouponKind;
  value: number;
  percentCap: number;
  eligiblePlans: string[];
  startsAt: string;
  endsAt: string;
  minOrderAmount: number;
  totalUses: number;
  perUserLimit: number;
  status: CouponStatus;
  internalNotes: string;
  currency: string;
}

export type CouponWriteResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: string };

/**
 * Validate a coupon draft. Returns a machine error code (mapped to HTTP/Persian
 * by the route layer) or null when valid. Kept separate from persistence so a
 * create and an edit share exactly one set of rules.
 */
export function validateDraft(draft: CouponDraft, excludeId?: string): string | null {
  const code = normalizeCode(draft.code);
  if (!code) return "CODE_REQUIRED";
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return "INVALID_CODE";
  if (codeExists(code, excludeId)) return "CODE_EXISTS";
  if (!draft.title?.trim()) return "COUPON_TITLE_REQUIRED";
  if (draft.kind !== "percent" && draft.kind !== "fixed") return "INVALID_KIND";

  if (!Number.isFinite(draft.value) || draft.value <= 0) return "INVALID_VALUE";
  if (draft.kind === "percent" && draft.value > 100) return "INVALID_VALUE";

  if (!Number.isFinite(draft.percentCap) || draft.percentCap <= 0 || draft.percentCap > 100) {
    return "INVALID_PERCENT_CAP";
  }
  if (!Number.isFinite(draft.minOrderAmount) || draft.minOrderAmount < 0) return "INVALID_MIN_ORDER";
  if (!Number.isInteger(draft.totalUses) || draft.totalUses < 0) return "INVALID_TOTAL_USES";
  if (!Number.isInteger(draft.perUserLimit) || draft.perUserLimit < 0) {
    return "INVALID_PER_USER_LIMIT";
  }

  const start = new Date(draft.startsAt).getTime();
  const end = new Date(draft.endsAt).getTime();
  if (Number.isNaN(start)) return "INVALID_START";
  if (Number.isNaN(end)) return "INVALID_END";
  if (end < start) return "END_BEFORE_START";

  if (!["active", "disabled", "archived"].includes(draft.status)) return "INVALID_STATUS";
  if (!Array.isArray(draft.eligiblePlans)) return "INVALID_PLANS";
  return null;
}

export function createCoupon(
  draft: CouponDraft,
  actor: string,
  now: Date = new Date()
): CouponWriteResult {
  const err = validateDraft(draft);
  if (err) return { ok: false, error: err };

  const iso = now.toISOString();
  const coupon: Coupon = {
    id: `cp-${crypto.randomUUID()}`,
    title: draft.title.trim(),
    code: normalizeCode(draft.code),
    kind: draft.kind,
    value: draft.value,
    percentCap: draft.percentCap,
    eligiblePlans: draft.eligiblePlans as Coupon["eligiblePlans"],
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    minOrderAmount: draft.minOrderAmount,
    totalUses: draft.totalUses,
    perUserLimit: draft.perUserLimit,
    status: draft.status,
    internalNotes: draft.internalNotes ?? "",
    currency: draft.currency || "IRT",
    usedCount: 0,
    createdBy: actor,
    updatedBy: actor,
    createdAt: iso,
    updatedAt: iso,
    archivedAt: draft.status === "archived" ? iso : null,
  };
  const rows = readCoupons();
  rows.push(coupon);
  writeCoupons(rows);
  return { ok: true, coupon };
}

/**
 * Apply an edit to a coupon. Editing NEVER rewrites past orders or past usage
 * rows (they hold their own snapshot); it only changes FUTURE validation.
 */
export function updateCoupon(
  id: string,
  draft: CouponDraft,
  actor: string,
  now: Date = new Date()
): CouponWriteResult {
  const rows = readCoupons();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "NOT_FOUND" };

  const err = validateDraft(draft, id);
  if (err) return { ok: false, error: err };

  const iso = now.toISOString();
  const before = rows[idx]!;
  const merged: Coupon = {
    ...before,
    title: draft.title.trim(),
    code: normalizeCode(draft.code),
    kind: draft.kind,
    value: draft.value,
    percentCap: draft.percentCap,
    eligiblePlans: draft.eligiblePlans as Coupon["eligiblePlans"],
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    minOrderAmount: draft.minOrderAmount,
    totalUses: draft.totalUses,
    perUserLimit: draft.perUserLimit,
    status: draft.status,
    internalNotes: draft.internalNotes ?? "",
    currency: draft.currency || "IRT",
    updatedBy: actor,
    updatedAt: iso,
    // archivedAt is set the first time a coupon is archived and cleared when it
    // is re-activated; it is never back-dated.
    archivedAt: draft.status === "archived" ? before.archivedAt ?? iso : null,
  };
  rows[idx] = merged;
  writeCoupons(rows);
  return { ok: true, coupon: merged };
}

/** Change only the status (enable/disable/archive). Reversible except archive. */
export function setCouponStatus(
  id: string,
  status: CouponStatus,
  actor: string,
  now: Date = new Date()
): Coupon | null {
  const rows = readCoupons();
  const row = rows.find((c) => c.id === id);
  if (!row) return null;
  if (!["active", "disabled", "archived"].includes(status)) return null;
  const iso = now.toISOString();
  row.status = status;
  row.updatedBy = actor;
  row.updatedAt = iso;
  if (status === "archived") {
    row.archivedAt = row.archivedAt ?? iso;
  } else {
    row.archivedAt = null;
  }
  writeCoupons(rows);
  return row;
}
