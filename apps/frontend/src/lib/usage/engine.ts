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
  SubscriptionDailyUsage,
  SubscriptionPeriodUsage,
  SubscriptionUsageSummary,
  UsageErrorCode,
  UsageTransaction,
} from "@legalir/types";

// ============================================================
// Stored rows
// ============================================================

/** The subscription row as persisted (snake_case, legacy-compatible). */
interface StoredSubscription {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status: string;
  status_fa: string;
  start_at: string;
  end_at: string;
  purchased_at: string;
  auto_renew: number;
  /** Frozen entitlements — absent on legacy rows (derived from the catalog). */
  plan_snapshot?: PlanEntitlementSnapshot;
}

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
  activity: ActivityType
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
  const requestExhausted =
    def.countsAsDailyRequest && bucket.requestUsed >= bucket.requestLimit;
  const pointsRemaining = bucket.pointsTotal - bucket.pointsUsed;
  const pointsExhausted = pointsRemaining < def.pointCost;

  if (requestExhausted || pointsExhausted) {
    // Fall back to reward points only when the product has enabled it.
    if (allowRewardPointsAfterLimit() && getRewardBalance(userId) >= def.pointCost) {
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

  const check = checkEntitlement(userId, activity);
  if (!check.allowed) {
    return {
      ok: false,
      code: check.code,
      messageFa: check.messageFa,
      transaction: null,
      replayed: false,
    };
  }

  const def = getActivity(activity)!;
  const ent = check.entitlement;
  const today = tehranDateString();

  // --- Debit the daily bucket (or the reward wallet) ---
  if (check.creditSource === "REWARD") {
    spendRewardPoints({
      userId,
      points: def.pointCost,
      sourceType: source,
      sourceId: relatedEntityId ?? idempotencyKey,
      description: `مصرف امتیاز بابت ${def.displayNameFa}`,
    });
  } else {
    const bucket = resolveDailyBucket(userId, ent, today);
    if (def.countsAsDailyRequest) bucket.requestUsed += 1;
    bucket.pointsUsed += def.pointCost;
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
    pointsCost: def.pointCost,
    requestCost: def.countsAsDailyRequest ? 1 : 0,
    tokenCost: 0,
    serviceQuotaType: def.quotaType,
    serviceQuotaCost: def.quotaType ? 1 : 0,
    creditSource: check.creditSource,
    source,
    relatedEntityId: relatedEntityId ?? null,
    status: "RESERVED",
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };
  const rows = readTable<UsageTransaction>(TX_TABLE);
  rows.push(tx);
  writeTable(TX_TABLE, rows);

  return { ok: true, code: null, messageFa: "", transaction: tx, replayed: false };
}

/** Mark a reservation COMPLETED and record the actual token usage. */
export function completeUsage(
  transactionId: string,
  opts: { tokens?: number } = {}
): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  if (tx.status === "COMPLETED") return tx;

  tx.status = "COMPLETED";
  tx.updatedAt = new Date().toISOString();

  // Record real token usage against the period quota (never estimated when
  // the provider reports actual usage).
  const tokens = opts.tokens ?? 0;
  if (tokens > 0) {
    tx.tokenCost = tokens;
    const period = resolvePeriodUsage(tx.userId, tx.subscriptionId ?? FREE_SUBSCRIPTION_ID);
    period.tokensUsed += tokens;
    savePeriodUsage(period);
  }

  writeTable(TX_TABLE, rows);
  return tx;
}

/**
 * Reverse a reservation — used when the service failed for an internal
 * reason, so the user's quota is not burned for nothing.
 */
export function reverseUsage(transactionId: string): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  if (tx.status === "REVERSED" || tx.status === "FAILED") return tx;

  const ent = resolveEntitlement(tx.userId);

  // Refund the daily bucket (only when the credit came from it).
  if (tx.creditSource === "SUBSCRIPTION") {
    const today = tehranDateString();
    const bucket = resolveDailyBucket(tx.userId, ent, today);
    if (tx.requestCost > 0) {
      bucket.requestUsed = Math.max(0, bucket.requestUsed - tx.requestCost);
    }
    bucket.pointsUsed = Math.max(0, bucket.pointsUsed - tx.pointsCost);
    saveDailyBucket(bucket);
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

  tx.status = "REVERSED";
  tx.updatedAt = new Date().toISOString();
  writeTable(TX_TABLE, rows);
  return tx;
}

/** Mark a reservation FAILED (terminal, no refund — e.g. a user error). */
export function failUsage(transactionId: string): UsageTransaction | null {
  const rows = readTable<UsageTransaction>(TX_TABLE);
  const tx = rows.find((t) => t.id === transactionId);
  if (!tx) return null;
  tx.status = "FAILED";
  tx.updatedAt = new Date().toISOString();
  writeTable(TX_TABLE, rows);
  return tx;
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
