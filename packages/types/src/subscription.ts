// ============================================================
// LEGALIR — Subscription / Payment / Energy-Ledger domain types
// ============================================================
// These types describe the Subscription & Entitlement platform:
//   • Payment        — a persisted, verifiable payment (the activation trigger)
//   • EnergyLedger   — the unified, read-time projection over the two energy
//                      assets (subscription grant vs. reward ledger) plus the
//                      consumption log (usage_transactions).
//
// They are ADDITIVE. The legacy `SubscriptionStatus` union is widened in
// `index.ts`; nothing here removes or renames an existing field.
// ============================================================

import type { PlanCode } from "./index";

// ============================================================
// Payment
// ============================================================

/**
 * The lifecycle of a *persisted* payment record. Distinct from the UI intent
 * status (`PaymentStatus`) so widening this union never breaks the checkout
 * status maps in the frontend.
 *
 *   pending → paid          (verified)
 *   pending → failed        (gateway declined)
 *   pending → cancelled     (user/expired)
 *   paid    → refunded      (money returned; entitlement reversed)
 */
export type PaymentRecordStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

/**
 * How the payment was taken. The MVP ships the mock gateway only. Named
 * `PaymentChannel` to avoid colliding with the property-contract
 * `PaymentMethod` union (a different domain) when both are re-exported.
 */
export type PaymentChannel = "mock" | "gateway" | "manual" | "admin" | "free";

/**
 * A persisted payment. Activation is derived from `status === "paid"`.
 * `idempotencyKey` guarantees a repeated success never activates twice;
 * `subscriptionId` makes the payment ⇄ subscription relationship traceable in
 * both directions.
 */
export interface Payment {
  id: string;
  userId: string;
  planCode: PlanCode;
  /** Amount actually charged, resolved SERVER-SIDE from the catalog. */
  amount: number;
  currency: string;
  status: PaymentRecordStatus;
  method: PaymentChannel;
  /** The subscription this payment belongs to (set when the row is created). */
  subscriptionId: string | null;
  /** Stable key: `pay:<userId>:<planCode>:<nonce>` — dedupes re-purchases. */
  idempotencyKey: string;
  /** Gateway/PSP reference, recorded on success (mock: a synthetic id). */
  transactionId: string | null;
  /** Correlation id for logs. */
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

// ============================================================
// Energy ledger (read-time projection — never stored)
// ============================================================

/** The kind of movement recorded in the unified energy ledger. */
export type EnergyTransactionType =
  | "SUBSCRIPTION_GRANT"
  | "DAILY_REWARD"
  | "REFERRAL_REWARD"
  | "CAMPAIGN_REWARD"
  | "ADMIN_GRANT"
  | "PURCHASE"
  | "USAGE"
  | "REFUND"
  | "EXPIRATION"
  | "ADJUSTMENT";

/**
 * Which asset a movement belongs to. Subscription credit is *bounded by the
 * subscription* (it resets daily and never transfers on plan change); reward
 * credit is *independent and persistent*. Keeping the source explicit is what
 * lets a future policy expire, refund or prioritise one without the other.
 */
export type EnergySource = "SUBSCRIPTION" | "REWARD";

/**
 * One row of the unified energy ledger. DERIVED, not stored: it is projected
 * on read from `subscriptions` (grants), `reward_ledger` (reward movements) and
 * `usage_transactions` (consumption + refunds). `balanceBefore`/`balanceAfter`
 * are computed by walking the merged stream in time order.
 */
export interface EnergyLedgerEntry {
  id: string;
  userId: string;
  type: EnergyTransactionType;
  source: EnergySource;
  /** Signed movement: positive = grant, negative = spend. */
  amount: number;
  /** Running balance (of the entry's own `source`) before this movement. */
  balanceBefore: number;
  /** Running balance after this movement. */
  balanceAfter: number;
  /** What the movement points at (payment id, subscription id, activity, …). */
  referenceId: string | null;
  referenceType: string | null;
  /** The subscription this movement is bound to (null for reward movements). */
  subscriptionId: string | null;
  description: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

/** Aggregates the admin/user energy panel renders. */
export interface EnergyLedgerSummary {
  /** Persistent reward-points balance (SUM over `reward_ledger`). */
  rewardBalance: number;
  /** Today's remaining subscription credit (points). */
  subscriptionRemaining: number;
  subscriptionGrantedToday: number;
  subscriptionUsedToday: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  entryCount: number;
}

export interface EnergyLedgerResponse {
  entries: EnergyLedgerEntry[];
  summary: EnergyLedgerSummary;
}

// ============================================================
// Admin — per-user subscription & energy management
// ============================================================

/** The full subscription + energy dossier an admin sees for one user. */
export interface AdminUserSubscriptionView {
  userId: string;
  /** The user's readable, server-generated system id (`LG-…`), or null. */
  publicId: string | null;
  displayName: string | null;
  mobileMasked: string;
  current: {
    id: string;
    planCode: PlanCode | null;
    planNameFa: string | null;
    status: string;
    startAt: string | null;
    endAt: string | null;
    daysRemaining: number | null;
    autoRenew: boolean;
    isFree: boolean;
    paymentId: string | null;
  };
  energy: EnergyLedgerSummary;
  history: AdminSubscriptionHistoryItem[];
  payments: Payment[];
  ledger: EnergyLedgerEntry[];
}

export interface AdminSubscriptionHistoryItem {
  id: string;
  planCode: string;
  planNameFa: string;
  amount: number;
  currency: string;
  status: string;
  statusFa: string;
  startAt: string;
  endAt: string;
  purchasedAt: string;
  paymentId: string | null;
  supersededAt: string | null;
}

export type AdminSubscriptionAction =
  | "activate"
  | "extend"
  | "deactivate"
  | "change_plan";

export interface AdminSubscriptionActionInput {
  action: AdminSubscriptionAction;
  planCode?: PlanCode;
  /** For `extend`: whole days to add. */
  days?: number;
  reason: string;
}

export type AdminEnergyAction = "grant" | "adjust";

export interface AdminEnergyActionInput {
  action: AdminEnergyAction;
  /** Signed amount: grant is positive; adjust may be negative. */
  amount: number;
  reason: string;
}
