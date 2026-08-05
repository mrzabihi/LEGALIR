// ============================================================
// LEGALIR — Entitlement Check Utility (Frontend UX Layer)
//
// IMPORTANT: These checks are UX-only. The backend enforces
// all entitlement boundaries as the final authority. Never
// rely on these checks for security — they exist solely to
// show appropriate UI states (lock icons, upgrade prompts)
// before the user hits a backend-enforced limit.
// ============================================================

import type { Entitlement } from "@legalir/types";

export interface EntitlementCheckResult {
  /** Whether the feature is available */
  allowed: boolean;
  /** Human-readable reason (Persian) */
  reason: string;
  /** Usage progress 0–1 (null for boolean features) */
  usageFraction: number | null;
  /** Remaining quota (null for unlimited/boolean features) */
  remaining: number | null;
  /** The underlying entitlement */
  entitlement: Entitlement;
  /** Suggested upgrade plan code */
  suggestedUpgrade: "pro" | "pro_max" | null;
}

/**
 * Check if a feature is available given a list of entitlements.
 * Returns detailed result including reason and upgrade suggestion.
 */
export function checkFeature(
  featureKey: string,
  entitlements: Entitlement[]
): EntitlementCheckResult {
  const entitlement = entitlements.find((e) => e.featureKey === featureKey);

  // Feature not found in entitlements → locked entirely
  if (!entitlement) {
    return {
      allowed: false,
      reason: "این ویژگی در پلن فعلی شما در دسترس نیست.",
      usageFraction: null,
      remaining: null,
      entitlement: {
        featureKey,
        nameFa: featureKey,
        limit: null,
        period: "forever",
        used: 0,
        isBoolean: true,
        isEnabled: false,
      },
      suggestedUpgrade: "pro",
    };
  }

  // Feature not enabled → locked
  if (!entitlement.isEnabled) {
    return {
      allowed: false,
      reason: `قابلیت «${entitlement.nameFa}» در پلن فعلی شما فعال نیست.`,
      usageFraction: null,
      remaining: null,
      entitlement,
      suggestedUpgrade: "pro_max",
    };
  }

  // Boolean feature (no limit) → always allowed if enabled
  if (entitlement.isBoolean) {
    return {
      allowed: true,
      reason: "",
      usageFraction: null,
      remaining: null,
      entitlement,
      suggestedUpgrade: null,
    };
  }

  // Numeric feature → check usage vs limit
  const limit = entitlement.limit;
  if (limit !== null && entitlement.used >= limit) {
    return {
      allowed: false,
      reason: `سقف «${entitlement.nameFa}» پر شده است (${entitlement.used} از ${limit}).`,
      usageFraction: 1,
      remaining: 0,
      entitlement,
      suggestedUpgrade: "pro_max",
    };
  }

  const remaining = limit !== null ? limit - entitlement.used : null;
  const fraction = limit !== null ? entitlement.used / limit : 0;

  return {
    allowed: true,
    reason: "",
    usageFraction: fraction,
    remaining,
    entitlement,
    suggestedUpgrade: null,
  };
}

/**
 * Check multiple features at once.
 */
export function checkFeatures(
  featureKeys: string[],
  entitlements: Entitlement[]
): Map<string, EntitlementCheckResult> {
  const results = new Map<string, EntitlementCheckResult>();
  for (const key of featureKeys) {
    results.set(key, checkFeature(key, entitlements));
  }
  return results;
}

/**
 * Check if user has any active subscription.
 */
export function hasActiveSubscription(
  subscription: { status: string } | null | undefined
): boolean {
  return subscription?.status === "active";
}

/**
 * Get upgrade suggestion for feature visibility — which plan to show
 * as the upgrade target when a feature is locked.
 */
export function getUpgradePlanForFeature(featureKey: string): "pro" | "pro_max" {
  // Features gated to pro_max tier
  const proMaxFeatures = ["PRIORITY_PROCESSING"];
  if (proMaxFeatures.includes(featureKey)) {
    return "pro_max";
  }
  return "pro";
}
