// ============================================================
// LEGALIR — Canonical subscription state
// ============================================================
// Single source of truth for every subscription surface (header chip,
// sidebar badge, dashboard card, settings details). Derives the display
// state ONCE from the raw V1Subscription so no surface re-computes
// remaining days or status independently.
//
// Business rules (thresholds) live here, not in the UI.
// ============================================================

import type { PlanCode, SubscriptionStatus, V1Subscription } from "@legalir/types";
import { toPersianNumber } from "./persian-utils";

/**
 * A subscription is "expiring soon" when this many days or fewer remain.
 * Configurable business rule — the UI must never hard-code this.
 */
export const EXPIRING_SOON_DAYS = 7;

/** Display state shared by every subscription surface. */
export type SubscriptionState =
  | "active"
  | "expiring_soon"
  | "expired"
  | "free"
  | "loading";

export interface SubscriptionStatusView {
  state: SubscriptionState;
  /** Raw plan code, or null for a free user. */
  planCode: PlanCode | null;
  /** Persian plan name, or null for a free user. */
  planNameFa: string | null;
  /** Remaining days (0 when expired/free). */
  daysRemaining: number;
  /** ISO end date, or null. */
  endAt: string | null;
  /** Whether the user has a paid, non-expired subscription. */
  isPaid: boolean;
  /** Whether the subscription has lapsed. */
  isExpired: boolean;
  /** Whether the subscription is within the expiring-soon window. */
  isExpiringSoon: boolean;
  /** Whether the user can renew (expired or expiring). */
  canRenew: boolean;
  /** Whether the user can upgrade (any non-diamond paid plan, or free). */
  canUpgrade: boolean;
  /** Persian label for the current state. */
  statusLabelFa: string;
  /** Short Persian summary, e.g. «۲۸ روز باقی‌مانده». */
  remainingLabelFa: string;
}

/** Whole days between now and `endAt`, floored at 0. */
export function daysUntil(endAt: string, now: number = Date.now()): number {
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

const STATUS_LABEL_FA: Record<SubscriptionStatus, string> = {
  active: "فعال",
  expired: "منقضی شده",
  cancelled: "لغو شده",
  pending: "در انتظار پرداخت",
};

/**
 * Derive the canonical display state from a raw subscription.
 * `undefined` = still loading; `null` = no subscription (free user).
 */
export function deriveSubscriptionStatus(
  sub: V1Subscription | null | undefined,
  now: number = Date.now()
): SubscriptionStatusView {
  if (sub === undefined) {
    return {
      state: "loading",
      planCode: null,
      planNameFa: null,
      daysRemaining: 0,
      endAt: null,
      isPaid: false,
      isExpired: false,
      isExpiringSoon: false,
      canRenew: false,
      canUpgrade: false,
      statusLabelFa: "",
      remainingLabelFa: "",
    };
  }

  if (sub === null) {
    return {
      state: "free",
      planCode: null,
      planNameFa: null,
      daysRemaining: 0,
      endAt: null,
      isPaid: false,
      isExpired: false,
      isExpiringSoon: false,
      canRenew: false,
      canUpgrade: true,
      statusLabelFa: "پلن رایگان",
      remainingLabelFa: "اشتراک فعال ندارید",
    };
  }

  const days = daysUntil(sub.endAt, now);
  const isExpired = sub.status === "expired" || sub.status === "cancelled" || days <= 0;
  const isExpiringSoon = !isExpired && days <= EXPIRING_SOON_DAYS;
  const state: SubscriptionState = isExpired
    ? "expired"
    : isExpiringSoon
      ? "expiring_soon"
      : "active";

  return {
    state,
    planCode: sub.planCode,
    planNameFa: sub.planNameFa,
    daysRemaining: days,
    endAt: sub.endAt,
    isPaid: !isExpired,
    isExpired,
    isExpiringSoon,
    canRenew: isExpired || isExpiringSoon,
    canUpgrade: sub.planCode !== "diamond",
    statusLabelFa: isExpired ? "منقضی شده" : STATUS_LABEL_FA[sub.status] ?? "فعال",
    remainingLabelFa: isExpired
      ? "اشتراک منقضی شده"
      : isExpiringSoon
        ? `${toPersianNumber(days)} روز تا پایان اشتراک`
        : `${toPersianNumber(days)} روز باقی‌مانده`,
  };
}
