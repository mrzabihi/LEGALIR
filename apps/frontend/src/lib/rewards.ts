// ============================================================
// LEGALIR — Rewards & Loyalty (typed domain configuration)
// ============================================================
// Backend is the source of truth for all point amounts. The frontend
// only displays values it receives — never decides how many points to award.
// See DOCUMENTS/IMPLEMENTATION_REPORTS/REWARDS_PROFILE/REWARD_SYSTEM_ARCHITECTURE.md
// ============================================================

export type RewardEventType =
  | "PROFILE_COMPLETED"
  | "DAILY_VISIT"
  | "REFERRAL_COMPLETED"
  | "SUBSCRIPTION_SILVER_PURCHASED"
  | "SUBSCRIPTION_GOLD_PURCHASED"
  | "SUBSCRIPTION_DIAMOND_PURCHASED";

export type RewardFrequency = "once_per_account" | "once_per_day" | "once_per_purchase";

export interface RewardRule {
  eventType: RewardEventType;
  points: number;
  frequency: RewardFrequency;
  /** Feature-flagged rules are configured but not triggerable yet. */
  enabled: boolean;
  labelFa: string;
  descriptionFa: string;
}

export const REWARD_RULES: readonly RewardRule[] = [
  {
    eventType: "PROFILE_COMPLETED",
    points: 1000,
    frequency: "once_per_account",
    enabled: true,
    labelFa: "تکمیل پروفایل",
    descriptionFa: "تکمیل کامل پروفایل (اطلاعات پایه + پروفایل حقوقی)",
  },
  {
    eventType: "DAILY_VISIT",
    points: 100,
    frequency: "once_per_day",
    enabled: true,
    labelFa: "سر زدن روزانه",
    descriptionFa: "ورود روزانه به محیط کار LEGALIR",
  },
  {
    eventType: "REFERRAL_COMPLETED",
    points: 500,
    frequency: "once_per_account",
    enabled: false, // Not implemented yet — behind feature flag
    labelFa: "دعوت از دوستان",
    descriptionFa: "معرفی موفق دوستان به LEGALIR (به‌زودی)",
  },
  {
    eventType: "SUBSCRIPTION_SILVER_PURCHASED",
    points: 850,
    frequency: "once_per_purchase",
    enabled: true,
    labelFa: "خرید اشتراک نقره‌ای",
    descriptionFa: "امتیاز خرید موفق اشتراک نقره‌ای",
  },
  {
    eventType: "SUBSCRIPTION_GOLD_PURCHASED",
    points: 1000,
    frequency: "once_per_purchase",
    enabled: true,
    labelFa: "خرید اشتراک طلایی",
    descriptionFa: "امتیاز خرید موفق اشتراک طلایی",
  },
  {
    eventType: "SUBSCRIPTION_DIAMOND_PURCHASED",
    points: 1500,
    frequency: "once_per_purchase",
    enabled: true,
    labelFa: "خرید اشتراک الماس",
    descriptionFa: "امتیاز خرید موفق اشتراک الماس",
  },
];

export function getRewardRule(eventType: RewardEventType): RewardRule | undefined {
  return REWARD_RULES.find((r) => r.eventType === eventType);
}

export function pointsForEvent(eventType: RewardEventType): number {
  return getRewardRule(eventType)?.points ?? 0;
}

/** Maps a subscription plan code to its purchase reward event. */
export function purchaseEventForPlan(planCode: string): RewardEventType | null {
  switch (planCode) {
    case "silver":
      return "SUBSCRIPTION_SILVER_PURCHASED";
    case "gold":
      return "SUBSCRIPTION_GOLD_PURCHASED";
    case "diamond":
      return "SUBSCRIPTION_DIAMOND_PURCHASED";
    default:
      return null;
  }
}

// ============================================================
// Timezone — the Iranian product's business day is Asia/Tehran.
// Timestamps are stored in UTC; the "reward day" is derived in Tehran.
// ============================================================

export function tehranDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
