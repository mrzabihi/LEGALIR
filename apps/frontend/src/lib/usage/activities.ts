// ============================================================
// LEGALIR — Central Activity Registry
// ============================================================
// Every billable user activity is defined here ONCE. No feature may
// subtract points or decrement a quota on its own — it must go through
// the Entitlement & Usage Engine, which reads this registry.
//
// The registry is the single place that answers:
//   • how many points does this activity cost?
//   • does it consume a daily request?
//   • which period-scoped service quota does it consume?
// ============================================================

import type { ActivityDefinition, ActivityType } from "@legalir/types";

/** Default points charged per billable activity (admin-overridable per plan). */
export const BASE_ACTIVITY_COST = 100;

export const ACTIVITY_REGISTRY: readonly ActivityDefinition[] = [
  {
    code: "AI_MESSAGE",
    displayNameFa: "گفتگوی هوشمند",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "AI_MESSAGES",
    enabled: true,
  },
  {
    code: "LEGAL_CHAT_REQUEST",
    displayNameFa: "درخواست مشاوره حقوقی",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "AI_MESSAGES",
    enabled: true,
  },
  {
    code: "DOCUMENT_ANALYSIS",
    displayNameFa: "تحلیل سند",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "DOCUMENT_ANALYSIS",
    enabled: true,
  },
  {
    code: "CONTRACT_DRAFT",
    displayNameFa: "پیش‌نویس قرارداد",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "CONTRACT_DRAFT",
    enabled: true,
  },
  {
    code: "CONTRACT_CREATE",
    displayNameFa: "ایجاد قرارداد",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "CONTRACT_CREATION",
    enabled: true,
  },
  {
    code: "DOCUMENT_GENERATION",
    displayNameFa: "تولید سند",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: null,
    enabled: true,
  },
  {
    code: "LEGAL_CALCULATION",
    displayNameFa: "محاسبه حقوقی",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: null,
    enabled: true,
  },
  {
    code: "CASE_ANALYSIS",
    displayNameFa: "تحلیل پرونده",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: null,
    enabled: true,
  },
  {
    code: "LAWYER_AI_PREPARATION",
    displayNameFa: "آماده‌سازی هوشمند وکیل",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: null,
    enabled: true,
  },
  {
    code: "REGENERATE_AI_RESPONSE",
    displayNameFa: "تولید مجدد پاسخ",
    pointCost: BASE_ACTIVITY_COST,
    countsAsDailyRequest: true,
    quotaType: "AI_MESSAGES",
    enabled: true,
  },
];

const BY_CODE = new Map<ActivityType, ActivityDefinition>(
  ACTIVITY_REGISTRY.map((a) => [a.code, a])
);

export function getActivity(code: ActivityType): ActivityDefinition | undefined {
  return BY_CODE.get(code);
}

/** Persian label for a service quota type (used in the dashboard). */
export const SERVICE_QUOTA_LABELS: Record<string, string> = {
  AI_MESSAGES: "پیام هوش مصنوعی",
  TOKENS: "توکن",
  DOCUMENT_ANALYSIS: "تحلیل سند",
  CONTRACT_DRAFT: "پیش‌نویس قرارداد",
  CONTRACT_CREATION: "ایجاد قرارداد",
};
