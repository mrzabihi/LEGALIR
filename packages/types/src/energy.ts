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

import type { ActivityType, ServiceQuotaType } from "./index";

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
