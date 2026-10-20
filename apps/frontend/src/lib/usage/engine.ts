// ============================================================
// LEGALIR — Entitlement & Usage Engine (server-only)
// ============================================================
// The ONE place every billable activity must pass through. No feature
// may subtract points or decrement a quota on its own.
//
//   Plan → Subscription → Entitlements → User Activity
//        → Usage Reservation → Service Execution
//        → Usage Completion → Real-time Dashboard
//
// Two assets are kept strictly separate:
//   • Subscription Daily Credit — resets at Tehran midnight, never carries over
//   • Reward Points             — persistent ledger, never reset here
//
// Concurrency: every read-modify-write below is fully SYNCHRONOUS. Node is
// single-threaded and there is no `await` inside a critical section, so two
// simultaneous requests are serialized and can never overspend a quota.
// ============================================================

import {
  readTable,
  writeTable,
  getRewardBalance,
  spendRewardPoints,
  nextTehranMidnight,
} from "@/lib/db";
import { tehranDateString } from "@/lib/rewards";
import { getActivity, SERVICE_QUOTA_LABELS } from "./activities";
import { listCostRules, priceWithFrozenSnapshot, pricedPointsFor } from "./energy";
import {
  getPlanByCode,
  snapshotFor,
  FREE_TIER_SNAPSHOT,
  dailyPointsFor,
} from "./plans";
import type {
  ActivityType,
  DailyCreditView,
  PeriodQuotaView,
  PlanEntitlementSnapshot,
  ServiceQuotaType,
  StoredSubscription,
  SubscriptionDailyUsage,
  SubscriptionPeriodUsage,
  SubscriptionUsageSummary,
  UsageCostContext,
  UsageErrorCode,
  UsageTariffSnapshot,
  UsageTransaction,
} from "@legalir/types";
import type { RewardLedgerEntry } from "@/lib/db";

// ============================================================
// Stored rows
// ============================================================
// `StoredSubscription` (the persisted `subscriptions` row) is declared once in
// @legalir/types and imported above.

const DAILY_TABLE = "subscription_daily_usage";
const PERIOD_TABLE = "subscription_period_usage";
const TX_TABLE = "usage_transactions";
const SETTINGS_TABLE = "platform_settings";

/** Synthetic subscription id for the free tier (no active subscription). */
const FREE_SUBSCRIPTION_ID = "free";

// ============================================================
// Platform settings
// ============================================================

interface PlatformSettingsRow {
  key: string;
  value: unknown;
}

/**
 * Whether reward points may be spent once the daily subscription credit is
 * exhausted. Defaults to false — the product has not decided this yet, so we
 * do not invent the behaviour.
 */
export function allowRewardPointsAfterLimit(): boolean {
  const row = readTable<PlatformSettingsRow>(SETTINGS_TABLE).find(
    (r) => r.key === "allow_reward_points_after_subscription_limit"
  );
  return row?.value === true;
}

export function setPlatformSetting(key: string, value: unknown): void {
  const rows = readTable<PlatformSettingsRow>(SETTINGS_TABLE);
  const idx = rows.findIndex((r) => r.key === key);
  if (idx >= 0) rows[idx] = { key, value };
  else rows.push({ key, value });
  writeTable(SETTINGS_TABLE, rows);
}

// ============================================================
// Active subscription resolution
// ============================================================

export interface ResolvedEntitlement {
  subscriptionId: string;
  planCode: string | null;
  planNameFa: string | null;
  expiresAt: string | null;
  snapshot: PlanEntitlementSnapshot;
  /** True when the user has no active subscription (free tier). */
  isFree: boolean;
  /** True when the user HAD a subscription that has now lapsed. */
  expired: boolean;
}

/**
 * Resolve the user's live entitlement. An "active" row past its `end_at`
 * does NOT grant quota — expiry is checked here, not just by status.
 */
export function resolveEntitlement(userId: string): ResolvedEntitlement {
  const rows = readTable<StoredSubscription>("subscriptions").filter(
    (s) => s.user_id === userId
  );
  const now = Date.now();
  const active = rows
    .filter((s) => s.status === "active" && new Date(s.end_at).getTime() > now)
    .sort((a, b) => b.start_at.localeCompare(a.start_at))[0];

  if (active) {
    const snapshot =
      active.plan_snapshot ??
      (() => {
        const plan = getPlanByCode(active.plan_code);
        return plan ? snapshotFor(plan) : FREE_TIER_SNAPSHOT;
      })();
    return {
      subscriptionId: active.id,
      planCode: active.plan_code,
      planNameFa: active.plan_name_fa,
      expiresAt: active.end_at,
      snapshot,
      isFree: false,
      expired: false,
    };
  }

  const hadSubscription = rows.length > 0;
  return {
    subscriptionId: FREE_SUBSCRIPTION_ID,
    planCode: null,
    planNameFa: null,
    expiresAt: null,
    snapshot: FREE_TIER_SNAPSHOT,
    isFree: true,
    expired: hadSubscription,
  };
}

// ============================================================
// Daily bucket (resets at Tehran midnight, never deleted)
// ============================================================

function readDailyBuckets(): SubscriptionDailyUsage[] {
  return readTable<SubscriptionDailyUsage>(DAILY_TABLE);
}

/**
 * Get (or create) today's daily bucket for a subscription. A new bucket is
 * created when the local day rolls over OR the subscription changes — the
 * previous day's bucket is left untouched for audit.
 */
function resolveDailyBucket(
  userId: string,
  ent: ResolvedEntitlement,
  today: string
): SubscriptionDailyUsage {
  const rows = readDailyBuckets();
  const existing = rows.find(
    (b) =>
      b.userId === userId &&
      b.subscriptionId === ent.subscriptionId &&
      b.usageDate === today
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const bucket: SubscriptionDailyUsage = {
    id: `sdu-${crypto.randomUUID()}`,
    userId,
    subscriptionId: ent.subscriptionId,
    usageDate: today,
    requestLimit: ent.snapshot.dailyRequestLimit,
    requestUsed: 0,
    pointsTotal: dailyPointsFor({
      dailyRequestLimit: ent.snapshot.dailyRequestLimit,
      activityCostPoints: ent.snapshot.activityCostPoints,
    }),
    pointsUsed: 0,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(bucket);
  writeTable(DAILY_TABLE, rows);
  return bucket;
}

function saveDailyBucket(bucket: SubscriptionDailyUsage): void {
  const rows = readDailyBuckets();
  const idx = rows.findIndex((b) => b.id === bucket.id);
  if (idx >= 0) {
    bucket.updatedAt = new Date().toISOString();
    rows[idx] = bucket;
    writeTable(DAILY_TABLE, rows);
  }
}

// ============================================================
// Period usage (resets only when a new subscription period begins)
// ============================================================

function resolvePeriodUsage(
  userId: string,
  subscriptionId: string
): SubscriptionPeriodUsage {
  const rows = readTable<SubscriptionPeriodUsage>(PERIOD_TABLE);
  const existing = rows.find(
    (p) => p.userId === userId && p.subscriptionId === subscriptionId
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const row: SubscriptionPeriodUsage = {
    id: `spu-${crypto.randomUUID()}`,
    userId,
    subscriptionId,
    aiMessagesUsed: 0,
    tokensUsed: 0,
    documentAnalysesUsed: 0,
    contractDraftsUsed: 0,
    contractsCreatedUsed: 0,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(row);
  writeTable(PERIOD_TABLE, rows);
  return row;
}

function savePeriodUsage(row: SubscriptionPeriodUsage): void {
  const rows = readTable<SubscriptionPeriodUsage>(PERIOD_TABLE);
  const idx = rows.findIndex((p) => p.id === row.id);
  if (idx >= 0) {
    row.updatedAt = new Date().toISOString();
    rows[idx] = row;
    writeTable(PERIOD_TABLE, rows);
  }
}

/** The period limit for a service quota, from the frozen snapshot. */
function periodLimit(
  quota: ServiceQuotaType,
  snapshot: PlanEntitlementSnapshot
): number {
  switch (quota) {
    case "AI_MESSAGES":
      return snapshot.aiMessageLimit;
    case "TOKENS":
      return snapshot.tokenLimit;
    case "DOCUMENT_ANALYSIS":
      return snapshot.documentAnalysisLimit;
    case "CONTRACT_DRAFT":
      return snapshot.contractDraftLimit;
    case "CONTRACT_CREATION":
      return snapshot.contractCreationLimit;
  }
}

/** The period used-count for a service quota. */
function periodUsed(quota: ServiceQuotaType, row: SubscriptionPeriodUsage): number {
  switch (quota) {
    case "AI_MESSAGES":
      return row.aiMessagesUsed;
    case "TOKENS":
      return row.tokensUsed;
    case "DOCUMENT_ANALYSIS":
      return row.documentAnalysesUsed;
    case "CONTRACT_DRAFT":
      return row.contractDraftsUsed;
    case "CONTRACT_CREATION":
      return row.contractsCreatedUsed;
  }
}

function incrementPeriodUsed(
  quota: ServiceQuotaType,
  row: SubscriptionPeriodUsage,
  amount: number
): void {
  switch (quota) {
    case "AI_MESSAGES":
      row.aiMessagesUsed += amount;
      break;
    case "TOKENS":
      row.tokensUsed += amount;
      break;
    case "DOCUMENT_ANALYSIS":
      row.documentAnalysesUsed += amount;
      break;
    case "CONTRACT_DRAFT":
      row.contractDraftsUsed += amount;
      break;
    case "CONTRACT_CREATION":
      row.contractsCreatedUsed += amount;
      break;
  }
}

// ============================================================
// Entitlement check
// ============================================================

export interface EntitlementCheck {
  allowed: boolean;
  code: UsageErrorCode | null;
  messageFa: string;
  /** Where the points would come from if allowed. */
  creditSource: "SUBSCRIPTION" | "REWARD" | "NONE";
  /** The resolved entitlement, for callers that need the snapshot. */
  entitlement: ResolvedEntitlement;
}

const ERROR_MESSAGES: Record<UsageErrorCode, string> = {
  DAILY_REQUEST_LIMIT_EXCEEDED:
    "سهمیه درخواست روزانه پلن شما امروز به پایان رسیده و در شروع روز بعد بازنشانی می‌شود.",
  DAILY_POINTS_EXCEEDED:
    "اعتبار روزانه اشتراک شما به پایان رسیده و در شروع روز بعد بازنشانی می‌شود.",
  AI_MESSAGE_LIMIT_EXCEEDED: "سهمیه پیام هوش مصنوعی شما به پایان رسیده است.",
  TOKEN_LIMIT_EXCEEDED: "سهمیه توکن شما به پایان رسیده است.",
  DOCUMENT_ANALYSIS_LIMIT_EXCEEDED: "سهمیه تحلیل سند شما به پایان رسیده است.",
  CONTRACT_LIMIT_EXCEEDED: "سهمیه قرارداد شما به پایان رسیده است.",
  SUBSCRIPTION_EXPIRED: "اشتراک شما به پایان رسیده است.",
  NO_ACTIVE_SUBSCRIPTION: "برای استفاده از این سرویس به اشتراک فعال نیاز دارید.",
};

/**
 * Check whether an activity may proceed, WITHOUT consuming anything.
 * The daily credit is checked first; reward points are only considered when
 * the product has explicitly enabled that fallback.
 */
export function checkEntitlement(
  userId: string,
  activity: ActivityType,
  opts: {
    /**
     * The energy this request will cost. When 0 (a FREE tariff or an admin
     * zero-price), the credit balance is not a blocker — the daily REQUEST
     * allowance and period quotas still apply.
     */
    energyCost?: number;
  } = {}
): EntitlementCheck {
  const def = getActivity(activity);
  const ent = resolveEntitlement(userId);

  if (!def || !def.enabled) {
    return {
      allowed: false,
      code: "NO_ACTIVE_SUBSCRIPTION",
      messageFa: "این فعالیت در دسترس نیست.",
      creditSource: "NONE",
      entitlement: ent,
    };
  }

  const today = tehranDateString();
  const bucket = resolveDailyBucket(userId, ent, today);

  // --- Daily credit: the request allowance AND the points budget ---
  const requiredPoints = opts.energyCost ?? def.pointCost;
  const requestExhausted =
    def.countsAsDailyRequest && bucket.requestUsed >= bucket.requestLimit;
  const pointsRemaining = bucket.pointsTotal - bucket.pointsUsed;
  const pointsExhausted = requiredPoints > 0 && pointsRemaining < requiredPoints;

  if (requestExhausted || pointsExhausted) {
    // Fall back to reward points only when the product has enabled it.
    if (allowRewardPointsAfterLimit() && getRewardBalance(userId) >= requiredPoints) {
      return {
        allowed: true,
        code: null,
        messageFa: "",
        creditSource: "REWARD",
        entitlement: ent,
      };
    }
    // The request limit is the more specific reason when both are exhausted.
    const code: UsageErrorCode = requestExhausted
      ? "DAILY_REQUEST_LIMIT_EXCEEDED"
      : "DAILY_POINTS_EXCEEDED";
    return {
      allowed: false,
      code,
      messageFa: ERROR_MESSAGES[code],
      creditSource: "NONE",
      entitlement: ent,
    };
  }

  // --- Period-scoped service quota ---
  if (def.quotaType) {
    const limit = periodLimit(def.quotaType, ent.snapshot);
    const period = resolvePeriodUsage(userId, ent.subscriptionId);
    const used = periodUsed(def.quotaType, period);
    if (used >= limit) {
      const code = quotaErrorCode(def.quotaType);
      return {
        allowed: false,
        code,
        messageFa: ERROR_MESSAGES[code],
        creditSource: "NONE",
        entitlement: ent,
      };
    }
  }

  return {
    allowed: true,
    code: null,
    messageFa: "",
    creditSource: "SUBSCRIPTION",
    entitlement: ent,
  };
}

function quotaErrorCode(quota: ServiceQuotaType): UsageErrorCode {
  switch (quota) {
    case "AI_MESSAGES":
      return "AI_MESSAGE_LIMIT_EXCEEDED";
    case "TOKENS":
      return "TOKEN_LIMIT_EXCEEDED";
    case "DOCUMENT_ANALYSIS":
      return "DOCUMENT_ANALYSIS_LIMIT_EXCEEDED";
    case "CONTRACT_DRAFT":
    case "CONTRACT_CREATION":
      return "CONTRACT_LIMIT_EXCEEDED";
  }
}

// ============================================================
// Reserve / complete / reverse
// ============================================================

export interface ReserveResult {
  ok: boolean;
  code: UsageErrorCode | null;
  messageFa: string;
  transaction: UsageTransaction | null;
  /** True when an existing transaction was reused (idempotent replay). */
  replayed: boolean;
}

/** A stable, human-traceable id shown to users and support. */
function newTrackingId(): string {
  return `UT-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

/** Credit `amount` energy back to the source the transaction was charged from. */
function refundToSource(
  tx: UsageTransaction,
  amount: number,
  descriptionFa: string
): void {
  if (amount <= 0) return;

  if (tx.creditSource === "REWARD") {
    const rows = readTable<RewardLedgerEntry>("reward_ledger");
    rows.push({
      id: crypto.randomUUID(),
      user_id: tx.userId,
      event_type: "REFUND",
      points_delta: amount,
      source_type: tx.source,
      source_id: tx.id,
      // One refund per transaction: a second reverse can never double-credit.
      idempotency_key: `reward-refund:${tx.id}`,
      description: descriptionFa,
      metadata: { usageTransactionId: tx.id, trackingId: tx.trackingId },
      created_at: new Date().toISOString(),
    });
    writeTable("reward_ledger", rows);
    return;
  }

  const ent = resolveEntitlement(tx.userId);
  const today = tehranDateString();
  const bucket = resolveDailyBucket(tx.userId, ent, today);
  bucket.pointsUsed = Math.max(0, bucket.pointsUsed - amount);
  saveDailyBucket(bucket);
}

/** Debit `amount` extra energy from the source the transaction was charged from. */
function debitExtra(tx: UsageTransaction, amount: number): void {
  if (amount <= 0) return;
  if (tx.creditSource === "REWARD") {
    spendRewardPoints({
      userId: tx.userId,
      points: amount,
      sourceType: `${tx.source}:extra`,
      sourceId: tx.id,
      description: `تکمیل انرژی پس از تسویهٔ ${tx.trackingId ?? tx.id}`,
    });
    return;
  }
  const ent = resolveEntitlement(tx.userId);
  const today = tehranDateString();
  const bucket = resolveDailyBucket(tx.userId, ent, today);
  bucket.pointsUsed += amount;
  saveDailyBucket(bucket);
}

/**
 * Atomically check entitlements and reserve the cost of an activity.
 *
 * Idempotent: a repeated call with the same `idempotencyKey` returns the
 * existing transaction without charging again — so a double-click or a
 * network retry can never double-charge.
 */
export function reserveUsage(params: {
  userId: string;
  activity: ActivityType;
  source: string;
  relatedEntityId?: string | null;
  idempotencyKey: string;
  /**
   * The runtime facts an admin-configured pricing profile prices against
   * (model, token counts, RAG/tool usage, message index, …). Optional: when
   * omitted, or when no ENABLED profile exists, the registry's flat
   * `pointCost` is charged exactly as before.
   */
  costContext?: UsageCostContext;
  /**
   * An explicit per-call point cost that REPLACES the registry/priced cost.
   * Used by surfaces whose price is admin-configured per item rather than per
   * activity (e.g. a legal calculator's `energyCost`). When omitted the
   * existing flat/priced behaviour is unchanged.
   */
  overridePoints?: number;
}): ReserveResult {
  const { userId, activity, source, idempotencyKey, relatedEntityId } = params;

  // --- Idempotency: replay an existing reservation ---
  const existing = readTable<UsageTransaction>(TX_TABLE).find(
    (t) => t.idempotencyKey === idempotencyKey
  );
  if (existing) {
    return {
      ok: existing.status === "RESERVED" || existing.status === "COMPLETED",
      code: null,
      messageFa: "",
      transaction: existing,
      replayed: true,
    };
  }

  const def = getActivity(activity);
  if (!def) {
    return {
      ok: false,
      code: "NO_ACTIVE_SUBSCRIPTION",
      messageFa: "این فعالیت در دسترس نیست.",
      transaction: null,
      replayed: false,
    };
  }
  const ctx = params.costContext ?? {};

  // --- Admin energy model (disabled-by-default) ---
  // When an ENABLED pricing profile exists for this activity, its computed
  // total REPLACES the registry's flat `pointCost`. Otherwise `priced` is null
  // and the flat cost is charged — behaviour is never changed by merely
  // shipping the energy module.
  //
  // The context is always supplied (never gated on the caller): once an admin
  // enables a tariff it must apply to every request, not only those that
  // happen to pass runtime facts.
  const priced = pricedPointsFor(activity, ctx);
  const chargedPoints =
    params.overridePoints !== undefined
      ? Math.max(0, Math.round(params.overridePoints))
      : priced
        ? priced.points
        : def.pointCost;
  const breakdown = priced?.breakdown ?? null;

  // Price is resolved BEFORE the entitlement check so a FREE (zero-energy)
  // action is not blocked by an exhausted energy balance.
  const check = checkEntitlement(userId, activity, { energyCost: chargedPoints });
  if (!check.allowed) {
    return {
      ok: false,
      code: check.code,
      messageFa: check.messageFa,
      transaction: null,
      replayed: false,
    };
  }

  const ent = check.entitlement;
  const today = tehranDateString();

  const tariffSnapshot: UsageTariffSnapshot | null = priced
    ? {
        profileId: priced.profile.id,
        serviceKey: priced.profile.serviceKey,
        nameFa: priced.profile.nameFa,
        version: priced.profile.version ?? 1,
        billingMode: priced.profile.billingMode ?? "ENERGY",
        chargeBasis: priced.profile.chargeBasis ?? "PER_MESSAGE",
        ruleVersions: listCostRules(priced.profile.id).map((r) => ({
          id: r.id,
          version: r.version ?? 1,
        })),
        breakdown,
      }
    : null;

  // --- Debit the daily bucket (or the reward wallet) ---
  if (check.creditSource === "REWARD") {
    spendRewardPoints({
      userId,
      points: chargedPoints,
      sourceType: source,
      sourceId: relatedEntityId ?? idempotencyKey,
      description: `مصرف امتیاز بابت ${def.displayNameFa}`,
    });
  } else {
    const bucket = resolveDailyBucket(userId, ent, today);
    if (def.countsAsDailyRequest) bucket.requestUsed += 1;
    bucket.pointsUsed += chargedPoints;
    saveDailyBucket(bucket);
  }

  // --- Debit the period-scoped service quota ---
  if (def.quotaType) {
    const period = resolvePeriodUsage(userId, ent.subscriptionId);
    incrementPeriodUsed(def.quotaType, period, 1);
    savePeriodUsage(period);
  }

  const now = new Date().toISOString();
  const tx: UsageTransaction = {
    id: `utx-${crypto.randomUUID()}`,
    userId,
    subscriptionId: ent.isFree ? null : ent.subscriptionId,
    activityType: activity,
    pointsCost: chargedPoints,
    requestCost: def.countsAsDailyRequest ? 1 : 0,
    tokenCost: breakdown?.tokenCost ?? 0,
    serviceQuotaType: def.quotaType,
    serviceQuotaCost: def.quotaType ? 1 : 0,
    creditSource: check.creditSource,
    source,
    relatedEntityId: relatedEntityId ?? null,
    status: "RESERVED",
    idempotencyKey,
    // --- Energy-model attribution (only present when priced) ---
    serviceKey: priced ? priced.profile.serviceKey : null,
    model: ctx.model ?? null,
    inputTokens: ctx.inputTokens ?? 0,
    outputTokens: ctx.outputTokens ?? 0,
    contextTokens: ctx.contextTokens ?? 0,
    toolCalls: ctx.toolCalls ?? 0,
    ragCalls: ctx.ragCalls ?? 0,
    additionalCost: breakdown ? breakdown.unitCost + breakdown.ruleCost : 0,
    // --- Settlement + traceability ---
    energyFinal: chargedPoints,
    energyRefunded: 0,
    // No token figure has been observed yet; the caller must settle with the
    // provider's real usage (or explicitly declare it unavailable).
    tokenUsageStatus: "UNAVAILABLE",
    tokenUsageNoteFa: "در انتظار گزارش مصرف واقعی از ارائه‌دهندهٔ مدل",
    provider: null,
    trackingId: newTrackingId(),
    messageIndex: ctx.messageIndex ?? null,
    tariffVersion: priced ? (priced.profile.version ?? 1) : null,
    tariffSnapshot,
    createdAt: now,
    updatedAt: now,
  };
  const rows = readTable<UsageTransaction>(TX_TABLE);
  rows.push(tx);
  writeTable(TX_TABLE, rows);

  return { ok: true, code: null, messageFa: "", transaction: tx, replayed: false };
}

export interface CompleteUsageOptions {
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  model?: string | null;
  provider?: string | null;
  /**
   * The configured provider ROW that ran the request. `provider` above names
   * the wire protocol ("openai-compatible"/"mock"); this is the operator's
   * provider id, which is what the admin usage split groups by.
   */
  providerId?: string | null;
  /**
   * Runtime facts only known AFTER the operation ran (retrieval passes, tool
   * calls). They are written to the row before the frozen tariff re-prices, so
   * the final energy reflects what actually executed.
   */
  ragCalls?: number;
  toolCalls?: number;
  /**
   * How the token figure was obtained. `ACTUAL` = the provider reported it.
   * `ESTIMATED` = derived locally; `UNAVAILABLE` = no usable figure.
   */
  tokenUsageStatus?: "ACTUAL" | "ESTIMATED" | "UNAVAILABLE";
  tokenUsageNoteFa?: string | null;
}

/** The token figure as it should be persisted (never silently "actual"). */
function resolvedTokenFigure(opts: CompleteUsageOptions): {
  input: number;
  output: number;
  total: number;
  status: "ACTUAL" | "ESTIMATED" | "UNAVAILABLE";
  note: string | null;
} {
  const input = Math.max(0, Math.round(opts.inputTokens ?? 0));
  const output = Math.max(0, Math.round(opts.outputTokens ?? 0));
  const total = Math.max(0, Math.round(opts.tokens ?? input + output));
  const status = opts.tokenUsageStatus ?? (total > 0 ? "ACTUAL" : "UNAVAILABLE");
  const note =
    opts.tokenUsageNoteFa ??
    (status === "ESTIMATED"
      ? "تخمین محلی بر پایهٔ طول متن — ارائه‌دهنده مصرف واقعی را گزارش نکرد."
      : status === "UNAVAILABLE"
        ? opts.provider
          ? "مصرف واقعی توکن از ارائه‌دهنده دریافت نشد."
          : "این عملیات از مدل هوش مصنوعی استفاده نمی‌کند؛ توکنی مصرف نشده است."
        : null);
  return { input, output, total, status, note };
}

/**
 * Mark a reservation COMPLETED and settle the ENERGY against the real result.
 *
 * `opts.tokens` records the period-quota token consumption. The per-direction
 * counts are attributed to the ledger row.
 *
 * Settlement rule (explicit, testable):
 *   • The tariff that priced the reservation is RE-USED (frozen snapshot), so
 *     an admin edit between reserve and complete cannot change the price.
 *   • The final energy is recomputed with the observed token counts. A
 *     difference is refunded to, or debited from, the same source that paid
 *     the reservation. A zero-cost (FREE) tariff is never charged.
 *   • The transaction is terminal after this call — a repeated completion is a
 *     no-op, so a retried request can never charge twice.
 */
export function completeUsage(
  transactionId: string,
  opts: CompleteUsageOptions = {}
): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  if (tx.status === "COMPLETED" || tx.status === "REVERSED" || tx.status === "FAILED")
    return tx;

  tx.status = "COMPLETED";
  tx.updatedAt = new Date().toISOString();

  const figure = resolvedTokenFigure(opts);
  tx.inputTokens = figure.input;
  tx.outputTokens = figure.output;
  if (opts.contextTokens !== undefined) tx.contextTokens = opts.contextTokens;
  if (opts.model !== undefined) tx.model = opts.model;
  if (opts.provider !== undefined) tx.provider = opts.provider;
  if (opts.providerId !== undefined) tx.providerId = opts.providerId;
  if (opts.ragCalls !== undefined) tx.ragCalls = Math.max(0, Math.round(opts.ragCalls));
  if (opts.toolCalls !== undefined) tx.toolCalls = Math.max(0, Math.round(opts.toolCalls));
  tx.tokenUsageStatus = figure.status;
  tx.tokenUsageNoteFa = figure.note;

  // Record real token usage against the period quota.
  if (figure.total > 0) {
    tx.tokenCost = figure.total;
    const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
    period.tokensUsed += figure.total;
    savePeriodUsage(period);
  }

  // --- Energy settlement against the frozen tariff ------------------------
  const reserved = tx.energyFinal ?? tx.pointsCost;
  let finalEnergy = reserved;

  if (tx.tariffSnapshot?.breakdown) {
    const repriced = priceWithFrozenSnapshot(tx.tariffSnapshot, {
      model: tx.model ?? undefined,
      inputTokens: tx.inputTokens ?? 0,
      outputTokens: tx.outputTokens ?? 0,
      contextTokens: tx.contextTokens ?? 0,
      messageIndex: tx.messageIndex ?? undefined,
      ragCalls: tx.ragCalls ?? 0,
      toolCalls: tx.toolCalls ?? 0,
    });
    // A snapshot that cannot be re-priced keeps the reserved amount — never a
    // guess, never a silent change.
    if (repriced) finalEnergy = repriced.total;
  }

  const delta = finalEnergy - reserved;
  if (delta < 0) {
    const credit = -delta;
    refundToSource(tx, credit, `بازگشت مابه‌التفاوت انرژی ${tx.trackingId ?? tx.id}`);
    tx.energyRefunded = (tx.energyRefunded ?? 0) + credit;
  } else if (delta > 0) {
    debitExtra(tx, delta);
  }
  tx.energyFinal = finalEnergy;

  writeTable(TX_TABLE, rows);
  return tx;
}

/**
 * Reverse a reservation — the operation failed, was cancelled, or produced
 * nothing. Both the daily-credit and reward-funded paths are fully refunded,
 * the period quota is released, and the row is marked REVERSED.
 *
 * Idempotent: a second call returns the already-reversed row untouched.
 */
export function reverseUsage(transactionId: string): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  if (tx.status === "REVERSED" || tx.status === "FAILED") return tx;

  const ent = resolveEntitlement(tx.userId);
  const refundable = tx.energyFinal ?? tx.pointsCost;

  // Refund the daily bucket (only when the credit came from it).
  if (tx.creditSource === "SUBSCRIPTION") {
    const today = tehranDateString();
    const bucket = resolveDailyBucket(tx.userId, ent, today);
    if (tx.requestCost > 0) {
      bucket.requestUsed = Math.max(0, bucket.requestUsed - tx.requestCost);
    }
    bucket.pointsUsed = Math.max(0, bucket.pointsUsed - refundable);
    saveDailyBucket(bucket);
  } else if (tx.creditSource === "REWARD" && refundable > 0) {
    refundToSource(tx, refundable, `بازگشت انرژی ${tx.trackingId ?? tx.id}`);
  }

  // Refund the period-scoped service quota.
  if (tx.serviceQuotaType && tx.serviceQuotaCost > 0) {
    const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
    incrementPeriodUsed(tx.serviceQuotaType, period, -tx.serviceQuotaCost);
    savePeriodUsage(period);
  }

  // Refund recorded tokens.
  if (tx.tokenCost > 0) {
    const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
    period.tokensUsed = Math.max(0, period.tokensUsed - tx.tokenCost);
    savePeriodUsage(period);
  }

  tx.energyRefunded = (tx.energyRefunded ?? 0) + refundable;
  tx.energyFinal = 0;
  tx.status = "REVERSED";
  tx.updatedAt = new Date().toISOString();
  writeTable(TX_TABLE, rows);
  return tx;
}

/**
 * Mark a reservation FAILED.
 *
 * Default rule: the energy IS refunded — a failure must never silently burn a
 * user's quota. The explicit opt-out (`{ refund: false }`) exists only for the
 * rare case where the consumed resource was caused by the user and the product
 * has decided to charge for it; the row then keeps `energyFinal` and records
 * `energyRefunded = 0`, which the usage report surfaces as «ناموفق».
 */
export function failUsage(
  transactionId: string,
  opts: { refund?: boolean } = {}
): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  if (tx.status === "FAILED" || tx.status === "REVERSED" || tx.status === "COMPLETED")
    return tx;

  if (opts.refund !== false) {
    const refundable = tx.energyFinal ?? tx.pointsCost;
    const ent = resolveEntitlement(tx.userId);
    if (tx.creditSource === "SUBSCRIPTION") {
      const bucket = resolveDailyBucket(tx.userId, ent, tehranDateString());
      if (tx.requestCost > 0) {
        bucket.requestUsed = Math.max(0, bucket.requestUsed - tx.requestCost);
      }
      bucket.pointsUsed = Math.max(0, bucket.pointsUsed - refundable);
      saveDailyBucket(bucket);
    } else if (tx.creditSource === "REWARD" && refundable > 0) {
      refundToSource(tx, refundable, `بازگشت انرژی ${tx.trackingId ?? tx.id}`);
    }
    if (tx.serviceQuotaType && tx.serviceQuotaCost > 0) {
      const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
      incrementPeriodUsed(tx.serviceQuotaType, period, -tx.serviceQuotaCost);
      savePeriodUsage(period);
    }
    if (tx.tokenCost > 0) {
      const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
      period.tokensUsed = Math.max(0, period.tokensUsed - tx.tokenCost);
      savePeriodUsage(period);
    }
    tx.energyRefunded = (tx.energyRefunded ?? 0) + refundable;
    tx.energyFinal = 0;
  }

  tx.status = "FAILED";
  tx.tokenUsageStatus = tx.tokenUsageStatus ?? "UNAVAILABLE";
  tx.updatedAt = new Date().toISOString();
  writeTable(TX_TABLE, rows);
  return tx;
}

/**
 * Settle a reservation addressed by its idempotency key rather than its row
 * id — the caller (document upload/complete, delete) only knows the key it
 * generated. Returns null when no reservation exists for that key.
 */
export function completeUsageByKey(
  idempotencyKey: string,
  opts: CompleteUsageOptions = {}
): UsageTransaction | null {
  const tx = readTable<UsageTransaction>(TX_TABLE).find(
    (t) => t.idempotencyKey === idempotencyKey
  );
  return tx ? completeUsage(tx.id, opts) : null;
}

/** Release a still-RESERVED charge addressed by its idempotency key. A row
 *  that already settled is left untouched (refund is not a delete). */
export function releaseReservedByKey(idempotencyKey: string): UsageTransaction | null {
  const tx = readTable<UsageTransaction>(TX_TABLE).find(
    (t) => t.idempotencyKey === idempotencyKey
  );
  if (!tx || tx.status !== "RESERVED") return tx ?? null;
  return reverseUsage(tx.id);
}

// ============================================================
// Summary (dashboard)
// ============================================================

export function getUsageSummary(userId: string): SubscriptionUsageSummary {
  const ent = resolveEntitlement(userId);
  const today = tehranDateString();
  const bucket = resolveDailyBucket(userId, ent, today);
  const period = resolvePeriodUsage(userId, ent.subscriptionId);

  const daily: DailyCreditView = {
    usageDate: bucket.usageDate,
    requestLimit: bucket.requestLimit,
    requestUsed: bucket.requestUsed,
    requestsRemaining: Math.max(0, bucket.requestLimit - bucket.requestUsed),
    pointsTotal: bucket.pointsTotal,
    pointsUsed: bucket.pointsUsed,
    pointsRemaining: Math.max(0, bucket.pointsTotal - bucket.pointsUsed),
    resetAt: nextTehranMidnight(),
  };

  const quotaTypes: ServiceQuotaType[] = [
    "AI_MESSAGES",
    "TOKENS",
    "DOCUMENT_ANALYSIS",
    "CONTRACT_DRAFT",
    "CONTRACT_CREATION",
  ];
  const periodViews: PeriodQuotaView[] = quotaTypes.map((q) => {
    const limit = periodLimit(q, ent.snapshot);
    const used = periodUsed(q, period);
    return {
      quotaType: q,
      nameFa: SERVICE_QUOTA_LABELS[q] ?? q,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      unlimited: false,
    };
  });

  const daysRemaining = ent.expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(ent.expiresAt).getTime() - Date.now()) / 86_400_000)
      )
    : null;

  return {
    hasSubscription: !ent.isFree,
    planCode: (ent.planCode as SubscriptionUsageSummary["planCode"]) ?? null,
    planNameFa: ent.planNameFa,
    expiresAt: ent.expiresAt,
    daysRemaining,
    subscriptionExpired: ent.expired,
    daily,
    period: periodViews,
    rewardPoints: getRewardBalance(userId),
    allowRewardPointsAfterLimit: allowRewardPointsAfterLimit(),
  };
}

/** The user's usage transaction history, newest first. */
export function getUsageHistory(
  userId: string,
  limit = 50
): UsageTransaction[] {
  return readTable<UsageTransaction>(TX_TABLE)
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
