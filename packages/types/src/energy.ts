// ============================================================
// LEGALIR — Energy & Service Cost Model Types
// ============================================================
// The admin-configurable pricing layer that sits on top of the single
// Entitlement & Usage Engine (`lib/usage/engine.ts`). It generalises the
// flat "1 request = N points" rule into a Usage-Billing-style model:
//
//   total = base request
//         + input/output/context token charge (per 1,000)
//         + per-unit auxiliary charges (tool, RAG, file, image, …)
//         + matched rule deltas
//         × model multiplier
//
// Everything is disabled-by-default: when no profile/rule exists for an
// activity, the engine falls back to the registry's flat `pointCost`, so
// existing behaviour is never changed by merely shipping this module.
// ============================================================

import type { ActivityType, ServiceQuotaType, UsageTransactionStatus } from "./index";

/** Auxiliary, per-operation units a service can charge for. */
export type ServiceCostUnit =
  | "TOOL_CALL"
  | "RAG_RETRIEVAL"
  | "FILE"
  | "IMAGE"
  | "VOICE"
  | "WEB_SEARCH"
  | "AGENT";

export const SERVICE_COST_UNIT_FA: Record<ServiceCostUnit, string> = {
  TOOL_CALL: "فراخوانی ابزار (Tool Call)",
  RAG_RETRIEVAL: "بازیابی RAG",
  FILE: "پردازش فایل",
  IMAGE: "پردازش تصویر",
  VOICE: "پردازش صدا",
  WEB_SEARCH: "جستجوی وب",
  AGENT: "اجرای عامل (Agent)",
};

export const SERVICE_COST_UNITS: readonly ServiceCostUnit[] = [
  "TOOL_CALL",
  "RAG_RETRIEVAL",
  "FILE",
  "IMAGE",
  "VOICE",
  "WEB_SEARCH",
  "AGENT",
] as const;

/**
 * Whether the service is billable at all. `FREE` is explicit: an admin can take
 * an action out of billing without deleting its configuration, and the engine
 * then charges exactly zero energy (never a fallback, never a flat cost).
 */
export type ServiceBillingMode = "ENERGY" | "FREE";

/**
 * What one charge covers:
 *   • PER_MESSAGE      — every request is priced (default; chat prices the
 *                        first message and every later one independently).
 *   • PER_CONVERSATION — only the FIRST request of a conversation is priced;
 *                        later requests in that conversation are free. Used
 *                        when the product sells a conversation, not a message.
 */
export type ServiceChargeBasis = "PER_MESSAGE" | "PER_CONVERSATION";

/**
 * A pricing profile for one billable activity (service). Amounts are energy
 * units (the same unit as reward/subscription points).
 */
export interface ServiceCostProfile {
  id: string;
  /** Stable slug, e.g. "ai-legal-assistant". */
  serviceKey: string;
  nameFa: string;
  descriptionFa: string;
  /** The engine activity this profile prices. */
  activity: ActivityType;
  enabled: boolean;
  /**
   * Monotonic version, bumped on every save. Transactions freeze the version
   * they were priced under, so a later edit can never rewrite history.
   */
  version?: number;
  /** `FREE` prices every request at zero energy. Defaults to `ENERGY`. */
  billingMode?: ServiceBillingMode;
  /** What one charge covers. Defaults to `PER_MESSAGE`. */
  chargeBasis?: ServiceChargeBasis;
  /** Base charge for a single request. */
  baseRequestCost: number;
  /** Energy per 1,000 input tokens. */
  inputTokenPer1k: number;
  /** Energy per 1,000 output tokens. */
  outputTokenPer1k: number;
  /** Energy per 1,000 context tokens. */
  contextTokenPer1k: number;
  /** Flat energy per auxiliary unit. A missing key means 0. */
  unitCosts: Partial<Record<ServiceCostUnit, number>>;
  /** Per-model multiplier (model id → factor). Absent → 1. */
  modelMultipliers: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** How a rule decides whether it applies to a request. */
export type ServiceCostRuleCondition =
  | "MESSAGE_INDEX_RANGE"
  | "INPUT_TOKENS_GT"
  | "OUTPUT_TOKENS_GT"
  | "CONTEXT_TOKENS_GT"
  | "RAG_USED"
  | "TOOL_USED"
  | "LAWYER_REVIEW"
  | "MODEL_IS";

export const SERVICE_COST_RULE_CONDITION_FA: Record<ServiceCostRuleCondition, string> = {
  MESSAGE_INDEX_RANGE: "شمارهٔ پیام در بازه",
  INPUT_TOKENS_GT: "توکن ورودی بیشتر از",
  OUTPUT_TOKENS_GT: "توکن خروجی بیشتر از",
  CONTEXT_TOKENS_GT: "توکن زمینه بیشتر از",
  RAG_USED: "استفاده از RAG",
  TOOL_USED: "فراخوانی ابزار",
  LAWYER_REVIEW: "نیازمند بازبینی وکیل",
  MODEL_IS: "مدل مورد استفاده",
};

/**
 * One pricing rule. Rules are evaluated in ascending `priority`; every
 * matching rule contributes `addEnergy` (added once) and `multiply` (if
 * set) to the running total.
 */
export interface ServiceCostRule {
  id: string;
  profileId: string;
  activity: ActivityType;
  labelFa: string;
  enabled: boolean;
  /** Monotonic version, bumped on every save (see `service_cost_history`). */
  version?: number;
  /** Lower runs first. */
  priority: number;
  condition: ServiceCostRuleCondition;
  /** Threshold / lower bound (message index or token count). */
  min: number | null;
  /** Upper bound (message-index ranges only). */
  max: number | null;
  /** Model ids the rule targets (MODEL_IS only). */
  models: string[];
  /** Flat energy added when the rule matches. */
  addEnergy: number;
  /** Multiplier applied to the running subtotal when set (> 0). */
  multiply: number | null;
  createdAt: string;
  updatedAt: string;
}

/** The runtime facts a cost computation is priced against. */
export interface UsageCostContext {
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  /** 1-based position of the message within the conversation, when known. */
  messageIndex?: number;
  /**
   * True when this request opens the conversation (no prior request exists).
   * Only `PER_CONVERSATION` pricing reads it.
   */
  firstInConversation?: boolean;
  ragUsed?: boolean;
  toolCalls?: number;
  /** Number of RAG retrievals performed for this request (detail for the ledger). */
  ragCalls?: number;
  fileCount?: number;
  imageCount?: number;
  voiceSeconds?: number;
  webSearches?: number;
  agentRuns?: number;
  lawyerReview?: boolean;
}

/** The transparent breakdown of a computed cost. */
export interface UsageCostBreakdown {
  baseCost: number;
  tokenCost: number;
  contextCost: number;
  unitCost: number;
  /** Net additional energy contributed by matched rules. */
  ruleCost: number;
  modelMultiplier: number;
  /** Running total before the model multiplier is applied. */
  subtotal: number;
  /** Final integer energy charged. */
  total: number;
  /** Ids of the rules that matched, in evaluation order. */
  appliedRuleIds: string[];
}

/** A single row of the queryable energy ledger. */
export interface UsageLedgerEntry {
  id: string;
  userId: string;
  serviceKey: string;
  activityType: ActivityType;
  /** The request/source this consumption belongs to. */
  requestId: string;
  serviceQuotaType: ServiceQuotaType | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  toolCalls: number;
  ragCalls: number;
  baseCost: number;
  tokenCost: number;
  additionalCost: number;
  totalEnergy: number;
  creditSource: "SUBSCRIPTION" | "REWARD" | "NONE";
  status: "RESERVED" | "COMPLETED" | "REVERSED" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

/** Aggregated ledger view for the admin energy dashboard. */
export interface UsageLedgerSummary {
  totalEntries: number;
  totalEnergy: number;
  reservedEnergy: number;
  completedEnergy: number;
  byService: { serviceKey: string; nameFa: string; entries: number; energy: number }[];
  byModel: { model: string; entries: number; energy: number }[];
  daily: { date: string; entries: number; energy: number }[];
}

// ============================================================
// Tariff version history (append-only)
// ============================================================
// Every save of a profile or rule appends a row here. A transaction freezes the
// profile version + the computed breakdown it was priced under, so a report
// always shows the tariff that was in force at the time of the operation —
// editing a tariff never rewrites past consumption.

export type TariffVersionEntity = "PROFILE" | "RULE";

/** One immutable snapshot of a tariff (profile or rule) after a save. */
export interface TariffVersionEntry {
  id: string;
  entity: TariffVersionEntity;
  /** The profile/rule id this version belongs to. */
  entityId: string;
  /** The engine activity the profile prices (null for a rule row). */
  activity: ActivityType | null;
  /** Monotonic version number for this entity id. */
  version: number;
  /** The full row as it was written (profile or rule). */
  snapshot: ServiceCostProfile | ServiceCostRule;
  changeKind: "CREATE" | "UPDATE" | "DELETE";
  /** Human-readable summary of the changed fields (Persian, for the UI). */
  changeSummaryFa: string;
  changedBy: string;
  changedAt: string;
}

/**
 * The pricing facts frozen onto a usage transaction at reserve time. `breakdown`
 * is null when the flat registry cost applied (no enabled tariff profile).
 */
export interface UsageTariffSnapshot {
  profileId: string;
  serviceKey: string;
  nameFa: string;
  version: number;
  billingMode: ServiceBillingMode;
  chargeBasis: ServiceChargeBasis;
  /** Versions of the rules in force at reserve time (for a faithful reprice). */
  ruleVersions: { id: string; version: number }[];
  breakdown: UsageCostBreakdown | null;
}

/** How the token figure on a transaction was obtained. */
export type TokenUsageStatus = "ACTUAL" | "ESTIMATED" | "UNAVAILABLE";

/** What the final energy settlement decided for one transaction. */
export type EnergySettlementStatus =
  | "RESERVED"
  | "CHARGED"
  | "REFUNDED"
  | "CREDITED"
  | "FAILED"
  | "FREE";

// ============================================================
// Usage reporting (user page + admin user tab + subscription card)
// ============================================================

/** One ledger row as the usage-report surfaces render it. */
export interface UsageReportItem {
  id: string;
  /** Human-traceable id shown to the user/admin (never a guess). */
  trackingId: string;
  activityType: ActivityType;
  serviceKey: string;
  serviceNameFa: string;
  actionNameFa: string;
  model: string | null;
  /** ISO timestamp of the operation. */
  createdAt: string;
  /** Energy reserved before the operation ran. */
  energyReserved: number;
  /** Energy actually settled (after finalize/refund). */
  energyFinal: number;
  /** Energy returned to the user (reversals + post-settlement credit). */
  energyRefunded: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokenStatus: TokenUsageStatus;
  tokenStatusReasonFa: string | null;
  status: UsageTransactionStatus;
  settlement: EnergySettlementStatus;
  settlementLabelFa: string;
  creditSource: "SUBSCRIPTION" | "REWARD" | "NONE";
  isFree: boolean;
  subscriptionId: string | null;
  relatedEntityId: string | null;
  tariffVersion: number | null;
  /** The breakdown frozen at reserve time (null when the flat cost applied). */
  breakdown: UsageCostBreakdown | null;
}

/** Aggregated totals for a filtered report — energy and tokens never merged. */
export interface UsageReportTotals {
  operations: number;
  /** Net settled energy (what the user really paid). */
  energy: number;
  energyReserved: number;
  energyRefunded: number;
  freeOperations: number;
  failedOperations: number;
  refundedOperations: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Operations whose token figure could not be read from the provider. */
  unavailableTokenOperations: number;
  estimatedTokenOperations: number;
}

/** Energy + token split for one service. */
export interface UsageServiceBreakdown {
  serviceKey: string;
  serviceNameFa: string;
  operations: number;
  energy: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Energy + token split for one action type. */
export interface UsageActionBreakdown {
  activityType: ActivityType;
  actionNameFa: string;
  serviceKey: string;
  operations: number;
  energy: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** The full report the user page and the admin user tab render. */
export interface UsageReportResponse {
  from: string;
  to: string;
  totals: UsageReportTotals;
  byService: UsageServiceBreakdown[];
  byAction: UsageActionBreakdown[];
  items: UsageReportItem[];
  /** Total item count before the page slice was applied. */
  totalItems: number;
  page: number;
  pageSize: number;
}

/** Query filters accepted by the report (all optional). */
export interface UsageReportQuery {
  from?: string;
  to?: string;
  serviceKey?: string;
  activityType?: ActivityType;
  status?: UsageTransactionStatus;
  /** Narrow to one subscription's real consumption (the subscription card). */
  subscriptionId?: string;
  page?: number;
  pageSize?: number;
}

/** The per-subscription usage banner on the subscriptions page. */
export interface SubscriptionUsageCard {
  subscriptionId: string;
  planNameFa: string;
  status: string;
  startAt: string;
  endAt: string;
  daysRemaining: number | null;
  /** Real consumption recorded against THIS subscription only. */
  energyUsed: number;
  energyRefunded: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  operations: number;
  /** Null when the plan defines no quota — never guessed. */
  energyQuota: number | null;
  energyRemaining: number | null;
}
