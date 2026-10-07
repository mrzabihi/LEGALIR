// ============================================================
// LEGALIR — Service Cost / Energy Model (server-only)
// ============================================================
// The admin-configurable pricing layer that sits ON TOP of the single
// Entitlement & Usage Engine. It generalises the registry's flat
// "1 request = N points" rule into a Usage-Billing-style model:
//
//   total = (base request
//          + input/output/context token charge      (per 1,000)
//          + per-unit auxiliary charges)            (tool, RAG, file, …)
//          ⊕ matched rule deltas (addEnergy / multiply)
//          × model multiplier
//
// DISABLED-BY-DEFAULT. When no enabled profile exists for an activity the
// engine falls back to the registry's flat `pointCost`, so shipping this
// module never changes existing behaviour — an admin must explicitly enable
// a profile for its prices to apply.
//
// STORAGE
//   service_cost_profiles  — one row per billable service
//   service_cost_rules     — pricing rules, keyed by profileId
//
// The queryable ledger is DERIVED from `usage_transactions` (the same rows the
// engine already writes), so there is one and only one consumption record.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import { getActivity, ACTIVITY_REGISTRY } from "./activities";
import type {
  ActivityType,
  ServiceCostProfile,
  ServiceCostRule,
  ServiceCostRuleCondition,
  ServiceCostUnit,
  UsageCostBreakdown,
  UsageCostContext,
  UsageLedgerEntry,
  UsageLedgerSummary,
  UsageTransaction,
} from "@legalir/types";

const PROFILES_TABLE = "service_cost_profiles";
const RULES_TABLE = "service_cost_rules";

// ============================================================
// Seeding
// ============================================================

/** A stable service slug + Persian name for each billable activity. */
const SEED_SERVICE: Record<ActivityType, { serviceKey: string; nameFa: string }> = {
  AI_MESSAGE: { serviceKey: "ai-legal-assistant", nameFa: "دستیار حقوقی هوشمند" },
  LEGAL_CHAT_REQUEST: { serviceKey: "legal-chat", nameFa: "گفتگوی حقوقی" },
  DOCUMENT_ANALYSIS: { serviceKey: "document-analysis", nameFa: "تحلیل سند" },
  CONTRACT_DRAFT: { serviceKey: "contract-draft", nameFa: "پیش‌نویس قرارداد" },
  CONTRACT_CREATE: { serviceKey: "contract-create", nameFa: "ایجاد قرارداد" },
  DOCUMENT_GENERATION: { serviceKey: "document-generation", nameFa: "تولید سند" },
  LEGAL_CALCULATION: { serviceKey: "legal-calculation", nameFa: "محاسبه حقوقی" },
  CASE_ANALYSIS: { serviceKey: "case-analysis", nameFa: "تحلیل پرونده" },
  LAWYER_AI_PREPARATION: { serviceKey: "lawyer-ai-prep", nameFa: "آماده‌سازی هوشمند وکیل" },
  REGENERATE_AI_RESPONSE: { serviceKey: "regenerate-response", nameFa: "تولید مجدد پاسخ" },
};

function seedProfiles(): ServiceCostProfile[] {
  const now = new Date().toISOString();
  const rows: ServiceCostProfile[] = ACTIVITY_REGISTRY.map((def) => {
    const meta = SEED_SERVICE[def.code] ?? {
      serviceKey: def.code.toLowerCase(),
      nameFa: def.displayNameFa,
    };
    return {
      id: `scp-${meta.serviceKey}`,
      serviceKey: meta.serviceKey,
      nameFa: meta.nameFa,
      descriptionFa: `مدل هزینهٔ سرویس ${def.displayNameFa}`,
      activity: def.code,
      enabled: false,
      baseRequestCost: def.pointCost,
      inputTokenPer1k: 0,
      outputTokenPer1k: 0,
      contextTokenPer1k: 0,
      unitCosts: {},
      modelMultipliers: {},
      createdAt: now,
      updatedAt: now,
      updatedBy: null,
    };
  });
  writeTable(PROFILES_TABLE, rows);
  return rows;
}

// ============================================================
// Profiles
// ============================================================

/** All pricing profiles, seeding the (disabled) defaults on first access. */
export function listCostProfiles(): ServiceCostProfile[] {
  const rows = readTable<ServiceCostProfile>(PROFILES_TABLE);
  return rows.length ? rows : seedProfiles();
}

export function getCostProfile(id: string): ServiceCostProfile | undefined {
  return listCostProfiles().find((p) => p.id === id);
}

export function getCostProfileForActivity(
  activity: ActivityType
): ServiceCostProfile | undefined {
  return listCostProfiles().find((p) => p.activity === activity);
}

export interface SaveCostProfileInput {
  id?: string;
  serviceKey: string;
  nameFa: string;
  descriptionFa?: string;
  activity: ActivityType;
  enabled: boolean;
  baseRequestCost: number;
  inputTokenPer1k: number;
  outputTokenPer1k: number;
  contextTokenPer1k: number;
  unitCosts: Partial<Record<ServiceCostUnit, number>>;
  modelMultipliers: Record<string, number>;
  updatedBy: string;
}

/** Create or update a pricing profile. */
export function saveCostProfile(
  input: SaveCostProfileInput
): ServiceCostProfile | { error: string } {
  if (!input.nameFa.trim()) return { error: "NAME_REQUIRED" };
  if (input.baseRequestCost < 0) return { error: "INVALID_AMOUNT" };

  const rows = listCostProfiles();
  const now = new Date().toISOString();
  const idx = input.id ? rows.findIndex((p) => p.id === input.id) : -1;

  const clean = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
  const unitCosts: Partial<Record<ServiceCostUnit, number>> = {};
  for (const [k, v] of Object.entries(input.unitCosts ?? {})) {
    if (typeof v === "number" && v > 0) unitCosts[k as ServiceCostUnit] = clean(v);
  }
  const modelMultipliers: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.modelMultipliers ?? {})) {
    if (typeof v === "number" && v > 0) modelMultipliers[k] = v;
  }

  if (idx >= 0) {
    const prev = rows[idx]!;
    const next: ServiceCostProfile = {
      ...prev,
      nameFa: input.nameFa.trim(),
      descriptionFa: input.descriptionFa?.trim() ?? prev.descriptionFa,
      activity: input.activity,
      enabled: input.enabled,
      baseRequestCost: clean(input.baseRequestCost),
      inputTokenPer1k: clean(input.inputTokenPer1k),
      outputTokenPer1k: clean(input.outputTokenPer1k),
      contextTokenPer1k: clean(input.contextTokenPer1k),
      unitCosts,
      modelMultipliers,
      updatedAt: now,
      updatedBy: input.updatedBy,
    };
    rows[idx] = next;
    writeTable(PROFILES_TABLE, rows);
    return next;
  }

  const created: ServiceCostProfile = {
    id: `scp-${crypto.randomUUID()}`,
    serviceKey: input.serviceKey.trim() || input.activity.toLowerCase(),
    nameFa: input.nameFa.trim(),
    descriptionFa: input.descriptionFa?.trim() ?? "",
    activity: input.activity,
    enabled: input.enabled,
    baseRequestCost: clean(input.baseRequestCost),
    inputTokenPer1k: clean(input.inputTokenPer1k),
    outputTokenPer1k: clean(input.outputTokenPer1k),
    contextTokenPer1k: clean(input.contextTokenPer1k),
    unitCosts,
    modelMultipliers,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };
  rows.push(created);
  writeTable(PROFILES_TABLE, rows);
  return created;
}

// ============================================================
// Rules
// ============================================================

/** All pricing rules, optionally scoped to one profile. Sorted by priority. */
export function listCostRules(profileId?: string): ServiceCostRule[] {
  const rows = readTable<ServiceCostRule>(RULES_TABLE);
  const scoped = profileId ? rows.filter((r) => r.profileId === profileId) : rows;
  return [...scoped].sort((a, b) => a.priority - b.priority);
}

export interface SaveCostRuleInput {
  id?: string;
  profileId: string;
  activity: ActivityType;
  labelFa: string;
  enabled: boolean;
  priority: number;
  condition: ServiceCostRuleCondition;
  min: number | null;
  max: number | null;
  models: string[];
  addEnergy: number;
  multiply: number | null;
}

/** Create or update a pricing rule. */
export function saveCostRule(input: SaveCostRuleInput): ServiceCostRule | { error: string } {
  if (!input.labelFa.trim()) return { error: "LABEL_REQUIRED" };
  if (!getCostProfile(input.profileId)) return { error: "PROFILE_NOT_FOUND" };

  const rows = readTable<ServiceCostRule>(RULES_TABLE);
  const now = new Date().toISOString();
  const idx = input.id ? rows.findIndex((r) => r.id === input.id) : -1;
  const multiply =
    input.multiply === null || !Number.isFinite(input.multiply) || input.multiply <= 0
      ? null
      : input.multiply;

  if (idx >= 0) {
    const prev = rows[idx]!;
    const next: ServiceCostRule = {
      ...prev,
      labelFa: input.labelFa.trim(),
      enabled: input.enabled,
      priority: Number.isFinite(input.priority) ? input.priority : prev.priority,
      condition: input.condition,
      min: input.min === null ? null : Math.round(input.min),
      max: input.max === null ? null : Math.round(input.max),
      models: input.models.filter(Boolean),
      addEnergy: Math.round(input.addEnergy) || 0,
      multiply,
      updatedAt: now,
    };
    rows[idx] = next;
    writeTable(RULES_TABLE, rows);
    return next;
  }

  const created: ServiceCostRule = {
    id: `scr-${crypto.randomUUID()}`,
    profileId: input.profileId,
    activity: input.activity,
    labelFa: input.labelFa.trim(),
    enabled: input.enabled,
    priority: Number.isFinite(input.priority) ? input.priority : 100,
    condition: input.condition,
    min: input.min === null ? null : Math.round(input.min),
    max: input.max === null ? null : Math.round(input.max),
    models: input.models.filter(Boolean),
    addEnergy: Math.round(input.addEnergy) || 0,
    multiply,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  writeTable(RULES_TABLE, rows);
  return created;
}

/** Delete a pricing rule. */
export function deleteCostRule(id: string): { ok: true } | { error: string } {
  const rows = readTable<ServiceCostRule>(RULES_TABLE);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return { error: "NOT_FOUND" };
  writeTable(RULES_TABLE, next);
  return { ok: true };
}

// ============================================================
// Cost computation (pure)
// ============================================================

/** True when `rule` applies to the given runtime context. */
function ruleMatches(rule: ServiceCostRule, ctx: UsageCostContext): boolean {
  const num = (v: number | undefined) => (typeof v === "number" ? v : 0);
  switch (rule.condition) {
    case "MESSAGE_INDEX_RANGE": {
      const idx = ctx.messageIndex;
      if (typeof idx !== "number") return false;
      const lo = rule.min ?? 1;
      const hi = rule.max ?? Number.POSITIVE_INFINITY;
      return idx >= lo && idx <= hi;
    }
    case "INPUT_TOKENS_GT":
      return num(ctx.inputTokens) > (rule.min ?? 0);
    case "OUTPUT_TOKENS_GT":
      return num(ctx.outputTokens) > (rule.min ?? 0);
    case "CONTEXT_TOKENS_GT":
      return num(ctx.contextTokens) > (rule.min ?? 0);
    case "RAG_USED":
      return Boolean(ctx.ragUsed) || num(ctx.ragCalls) > 0;
    case "TOOL_USED":
      return num(ctx.toolCalls) > 0;
    case "LAWYER_REVIEW":
      return Boolean(ctx.lawyerReview);
    case "MODEL_IS":
      return Boolean(ctx.model) && rule.models.includes(ctx.model as string);
    default:
      return false;
  }
}

/**
 * Compute the energy cost of one request against a profile + its rules.
 * Pure function — no I/O — so it is directly unit-testable.
 */
export function computeUsageCost(
  profile: ServiceCostProfile,
  rules: ServiceCostRule[],
  ctx: UsageCostContext
): UsageCostBreakdown {
  const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const round = (n: number) => Math.max(0, Math.round(n));

  const baseCost = profile.baseRequestCost;

  const inputTokens = num(ctx.inputTokens);
  const outputTokens = num(ctx.outputTokens);
  const contextTokens = num(ctx.contextTokens);
  const tokenCost = round(
    (inputTokens / 1000) * profile.inputTokenPer1k +
      (outputTokens / 1000) * profile.outputTokenPer1k
  );
  const contextCost = round((contextTokens / 1000) * profile.contextTokenPer1k);

  const u = profile.unitCosts;
  const ragCount = num(ctx.ragCalls) > 0 ? num(ctx.ragCalls) : ctx.ragUsed ? 1 : 0;
  const unitCost = round(
    num(ctx.toolCalls) * (u.TOOL_CALL ?? 0) +
      ragCount * (u.RAG_RETRIEVAL ?? 0) +
      num(ctx.fileCount) * (u.FILE ?? 0) +
      num(ctx.imageCount) * (u.IMAGE ?? 0) +
      num(ctx.voiceSeconds) * (u.VOICE ?? 0) +
      num(ctx.webSearches) * (u.WEB_SEARCH ?? 0) +
      num(ctx.agentRuns) * (u.AGENT ?? 0)
  );

  const preRule = baseCost + tokenCost + contextCost + unitCost;
  let running = preRule;
  const appliedRuleIds: string[] = [];

  for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
    if (!rule.enabled) continue;
    if (!ruleMatches(rule, ctx)) continue;
    appliedRuleIds.push(rule.id);
    running += rule.addEnergy;
    if (rule.multiply && rule.multiply > 0) running *= rule.multiply;
  }

  const ruleCost = running - preRule;
  const modelMultiplier =
    ctx.model && profile.modelMultipliers[ctx.model] ? profile.modelMultipliers[ctx.model]! : 1;
  const subtotal = running;
  const total = round(subtotal * modelMultiplier);

  return {
    baseCost,
    tokenCost,
    contextCost,
    unitCost,
    ruleCost,
    modelMultiplier,
    subtotal,
    total,
    appliedRuleIds,
  };
}

/**
 * The effective charge for an activity, given a runtime context.
 * Returns `null` when no ENABLED profile exists (→ engine uses the flat cost).
 */
export function pricedPointsFor(
  activity: ActivityType,
  ctx: UsageCostContext
): { points: number; breakdown: UsageCostBreakdown; profile: ServiceCostProfile } | null {
  const profile = getCostProfileForActivity(activity);
  if (!profile || !profile.enabled) return null;
  const rules = listCostRules(profile.id);
  const breakdown = computeUsageCost(profile, rules, ctx);
  return { points: breakdown.total, breakdown, profile };
}

// ============================================================
// Ledger (derived from usage_transactions)
// ============================================================

const LEDGER_STATUS: Record<string, UsageLedgerEntry["status"]> = {
  RESERVED: "RESERVED",
  COMPLETED: "COMPLETED",
  REVERSED: "REVERSED",
  FAILED: "FAILED",
};

/** Project one engine transaction into a ledger row. */
function toLedgerEntry(t: UsageTransaction): UsageLedgerEntry {
  return {
    id: t.id,
    userId: t.userId,
    serviceKey: t.serviceKey ?? "",
    activityType: t.activityType,
    requestId: t.relatedEntityId ?? "",
    serviceQuotaType: t.serviceQuotaType,
    model: t.model ?? null,
    inputTokens: t.inputTokens ?? 0,
    outputTokens: t.outputTokens ?? 0,
    contextTokens: t.contextTokens ?? 0,
    toolCalls: t.toolCalls ?? 0,
    ragCalls: t.ragCalls ?? 0,
    baseCost: t.requestCost,
    tokenCost: t.tokenCost,
    additionalCost: t.additionalCost ?? 0,
    totalEnergy: t.pointsCost,
    creditSource: t.creditSource,
    status: LEDGER_STATUS[t.status] ?? "COMPLETED",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export interface LedgerQuery {
  userId?: string;
  serviceKey?: string;
  activityType?: ActivityType;
  /** ISO date (inclusive) lower bound. */
  from?: string;
  /** ISO date (inclusive) upper bound. */
  to?: string;
}

/** The full consumption ledger, newest first, with optional filters. */
export function readLedger(query: LedgerQuery = {}): UsageLedgerEntry[] {
  let rows = readTable<UsageTransaction>("usage_transactions").map(toLedgerEntry);
  if (query.userId) rows = rows.filter((r) => r.userId === query.userId);
  if (query.serviceKey) rows = rows.filter((r) => r.serviceKey === query.serviceKey);
  if (query.activityType) rows = rows.filter((r) => r.activityType === query.activityType);
  if (query.from) rows = rows.filter((r) => r.createdAt >= query.from!);
  if (query.to) rows = rows.filter((r) => r.createdAt <= query.to!);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Aggregate the ledger for the admin energy dashboard. */
export function getLedgerSummary(rangeDays = 30): UsageLedgerSummary {
  const since = new Date(Date.now() - rangeDays * 86_400_000).toISOString();
  const rows = readLedger().filter((r) => r.createdAt >= since);

  let totalEnergy = 0;
  let reservedEnergy = 0;
  let completedEnergy = 0;
  const byService = new Map<
    string,
    { serviceKey: string; nameFa: string; entries: number; energy: number }
  >();
  const byModel = new Map<string, { model: string; entries: number; energy: number }>();
  const daily = new Map<string, { date: string; entries: number; energy: number }>();

  for (const r of rows) {
    totalEnergy += r.totalEnergy;
    if (r.status === "RESERVED") reservedEnergy += r.totalEnergy;
    if (r.status === "COMPLETED") completedEnergy += r.totalEnergy;

    const profile = getCostProfileForActivity(r.activityType);
    const sk = r.serviceKey || profile?.serviceKey || r.activityType;
    const svc = byService.get(sk) ?? {
      serviceKey: sk,
      nameFa: profile?.nameFa ?? r.activityType,
      entries: 0,
      energy: 0,
    };
    svc.entries += 1;
    svc.energy += r.totalEnergy;
    byService.set(sk, svc);

    if (r.model) {
      const m = byModel.get(r.model) ?? { model: r.model, entries: 0, energy: 0 };
      m.entries += 1;
      m.energy += r.totalEnergy;
      byModel.set(r.model, m);
    }

    const day = r.createdAt.slice(0, 10);
    const d = daily.get(day) ?? { date: day, entries: 0, energy: 0 };
    d.entries += 1;
    d.energy += r.totalEnergy;
    daily.set(day, d);
  }

  return {
    totalEntries: rows.length,
    totalEnergy,
    reservedEnergy,
    completedEnergy,
    byService: [...byService.values()].sort((a, b) => b.energy - a.energy),
    byModel: [...byModel.values()].sort((a, b) => b.energy - a.energy),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** A helper for the engine: default context derived from an activity. */
export function activityContext(activity: ActivityType): UsageCostContext {
  const def = getActivity(activity);
  return {
    ragUsed: def?.quotaType === "DOCUMENT_ANALYSIS" || def?.quotaType === "CONTRACT_DRAFT",
  };
}
