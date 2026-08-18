// ============================================================
// LEGALIR — JSON File Database
// Zero native dependencies. Data stored as JSON in .data/
// ============================================================

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { computeProfileCompletion } from "./profile-completion";
import {
  getRewardRule,
  tehranDateString,
  purchaseEventForPlan,
  type RewardEventType,
} from "./rewards";
import { seedDemoContent, DEMO_USER_MOBILE } from "./demo-seed";

const DB_DIR = path.resolve(process.cwd(), ".data");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ============================================================
// Types
// ============================================================

export interface DbUser {
  id: string;
  mobile: string;
  email: string | null;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
}

export interface DbSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ActivityRow {
  id: string;
  user_id: string;
  type: "conversation" | "document" | "contract";
  title: string;
  status: string;
  status_fa: string;
  description: string | null;
  category: string | null;
  category_fa: string | null;
  created_at: string;
  updated_at: string;
  archived: number;
}

export interface SubscriptionRow {
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
  autoRenew: boolean;
}

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
}

interface UsageStatsRow {
  user_id: string;
  daily_requests_used: number;
  daily_requests_total: number;
  tokens_used: number;
  tokens_total: number;
  document_analyses_used: number;
  document_analyses_total: number;
  contracts_generated: number;
  contracts_total: number;
}

export interface DbProfile {
  user_id: string;
  displayName: string | null;
  city: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  email: string | null;
  birthDate: string | null;
  gender: string | null;
  // Extended profile ("پروفایل حقوقی من")
  userType: string | null;
  province: string | null;
  legalInterests: string[] | null;
  primaryUseCase: string | null;
  // Cached overall completion (authoritative: recomputed on every read)
  completionPercent: number;
}

export interface DbPreferences {
  user_id: string;
  theme: string;
  locale: string;
  notifications: {
    appointments: boolean;
    contractExpiry: boolean;
    lawyerResponse: boolean;
    paymentStatus: boolean;
    caseUpdate: boolean;
    marketing: boolean;
  };
  privacy: {
    shareUsageData: boolean;
    allowAiTraining: boolean;
    storeConversationHistory: boolean;
    autoMemoryConsent: boolean;
  };
}

export interface RewardLedgerEntry {
  id: string;
  user_id: string;
  event_type: RewardEventType;
  points_delta: number;
  source_type: string;
  source_id: string;
  idempotency_key: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// User operations
// ============================================================

export function findUserByMobile(mobile: string): DbUser | undefined {
  return readTable<DbUser>("users").find((u) => u.mobile === mobile);
}

export function findUserById(id: string): DbUser | undefined {
  return readTable<DbUser>("users").find((u) => u.id === id);
}

export function createUser(params: {
  mobile: string;
  email?: string;
  passwordHash: string;
  displayName?: string;
}): DbUser {
  const users = readTable<DbUser>("users");
  const user: DbUser = {
    id: crypto.randomUUID(),
    mobile: params.mobile,
    email: params.email ?? null,
    passwordHash: params.passwordHash,
    displayName: params.displayName ?? null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeTable("users", users);
  return user;
}

// ============================================================
// Session operations
// ============================================================

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(userId: string): DbSession {
  const sessions = readTable<DbSession>("sessions");
  const session: DbSession = {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
  };
  sessions.push(session);
  writeTable("sessions", sessions);
  return session;
}

export function findSessionById(sessionId: string): DbSession | undefined {
  const sessions = readTable<DbSession>("sessions");
  const now = new Date().toISOString();
  return sessions.find((s) => s.id === sessionId && s.expiresAt > now);
}

export function deleteSession(sessionId: string): void {
  let sessions = readTable<DbSession>("sessions");
  sessions = sessions.filter((s) => s.id !== sessionId);
  writeTable("sessions", sessions);
}

export function deleteAllSessionsForUser(userId: string): void {
  let sessions = readTable<DbSession>("sessions");
  sessions = sessions.filter((s) => s.userId !== userId);
  writeTable("sessions", sessions);
}

export function cleanupExpiredSessions(): void {
  const now = new Date().toISOString();
  let sessions = readTable<DbSession>("sessions");
  sessions = sessions.filter((s) => s.expiresAt > now);
  writeTable("sessions", sessions);
}

// ============================================================
// Profile operations
// ============================================================

export function getProfile(userId: string): DbProfile {
  const profiles = readTable<DbProfile>("profiles");
  const existing = profiles.find((p) => p.user_id === userId);
  if (existing) return recomputeProfile(existing);
  // Return default empty profile
  return recomputeProfile({
    user_id: userId,
    displayName: null,
    city: null,
    occupation: null,
    avatarUrl: null,
    email: null,
    birthDate: null,
    gender: null,
    userType: null,
    province: null,
    legalInterests: null,
    primaryUseCase: null,
    completionPercent: 0,
  });
}

/** Recompute `completionPercent` from the authoritative domain rules. */
function recomputeProfile(profile: DbProfile): DbProfile {
  return {
    ...profile,
    completionPercent: computeProfileCompletion(profile).rounded,
  };
}

export function upsertProfile(userId: string, updates: Partial<Omit<DbProfile, "user_id">>): DbProfile {
  const profiles = readTable<DbProfile>("profiles");
  const idx = profiles.findIndex((p) => p.user_id === userId);
  if (idx >= 0) {
    const existing = profiles[idx]!;
    // Only apply keys that are explicitly present in updates (including null values),
    // to avoid overwriting existing data with undefined.
    const merged = { ...existing };
    for (const key of Object.keys(updates)) {
      (merged as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key];
    }
    const recomputed = recomputeProfile(merged);
    profiles[idx] = recomputed;
    writeTable("profiles", profiles);
    return recomputed;
  }

  const created: DbProfile = {
    user_id: userId,
    displayName: updates.displayName ?? null,
    city: updates.city ?? null,
    occupation: updates.occupation ?? null,
    avatarUrl: updates.avatarUrl ?? null,
    email: updates.email ?? null,
    birthDate: updates.birthDate ?? null,
    gender: updates.gender ?? null,
    userType: updates.userType ?? null,
    province: updates.province ?? null,
    legalInterests: updates.legalInterests ?? null,
    primaryUseCase: updates.primaryUseCase ?? null,
    completionPercent: updates.completionPercent ?? 0,
  };
  const recomputed = recomputeProfile(created);
  profiles.push(recomputed);
  writeTable("profiles", profiles);
  return recomputed;
}

export function updateUserDisplayName(userId: string, displayName: string): DbUser | undefined {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return undefined;
  user.displayName = displayName;
  writeTable("users", users);
  return user;
}

// ============================================================
// Preferences operations
// ============================================================

const DEFAULT_NOTIFICATIONS = {
  appointments: true,
  contractExpiry: true,
  lawyerResponse: true,
  paymentStatus: true,
  caseUpdate: true,
  marketing: false,
};

const DEFAULT_PRIVACY = {
  shareUsageData: true,
  allowAiTraining: false,
  storeConversationHistory: true,
  autoMemoryConsent: false,
};

export function getPreferences(userId: string): DbPreferences {
  const prefs = readTable<DbPreferences>("preferences");
  const existing = prefs.find((p) => p.user_id === userId);
  if (existing) return existing;
  return {
    user_id: userId,
    theme: "light",
    locale: "fa-IR",
    notifications: { ...DEFAULT_NOTIFICATIONS },
    privacy: { ...DEFAULT_PRIVACY },
  };
}

export function upsertPreferences(
  userId: string,
  updates: Partial<Omit<DbPreferences, "user_id">>
): DbPreferences {
  const prefs = readTable<DbPreferences>("preferences");
  const idx = prefs.findIndex((p) => p.user_id === userId);
  if (idx >= 0) {
    prefs[idx] = deepMerge(prefs[idx]!, updates) as DbPreferences;
  } else {
    prefs.push({
      user_id: userId,
      theme: updates.theme ?? "light",
      locale: updates.locale ?? "fa-IR",
      notifications: updates.notifications
        ? { ...DEFAULT_NOTIFICATIONS, ...updates.notifications }
        : { ...DEFAULT_NOTIFICATIONS },
      privacy: updates.privacy
        ? { ...DEFAULT_PRIVACY, ...updates.privacy }
        : { ...DEFAULT_PRIVACY },
    });
  }
  writeTable("preferences", prefs);
  return idx >= 0 ? prefs[idx]! : prefs[prefs.length - 1]!;
}

function deepMerge<T extends Record<string, unknown>>(base: T, updates: Partial<T>): T {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const val = updates[key];
    if (val === undefined) continue;
    if (typeof val === "object" && !Array.isArray(val) && val !== null) {
      result[key as string] = deepMerge(
        (result[key as string] as Record<string, unknown>) ?? {},
        val as Record<string, unknown>
      );
    } else {
      result[key as string] = val;
    }
  }
  return result as T;
}

// ============================================================
// Dashboard / Activity queries
// ============================================================

export function queryDashboard(userId: string) {
  const user = findUserById(userId);
  const activities = queryRecentActivity(userId, 5);
  const subscription = queryActiveSubscription(userId);
  return { user, recentActivity: activities, subscription };
}

export function queryRecentActivity(userId: string, limit = 5): ActivityRow[] {
  return readTable<ActivityRow>("activities")
    .filter((a) => a.user_id === userId && !a.archived)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}

export function queryActiveSubscription(userId: string) {
  const subs = readTable<StoredSubscription>("subscriptions");
  const sub = subs.find((s) => s.user_id === userId && s.status === "active");
  if (!sub) return null;
  return {
    id: sub.id,
    planCode: sub.plan_code,
    planNameFa: sub.plan_name_fa,
    amount: sub.amount,
    currency: sub.currency,
    status: sub.status,
    statusFa: sub.status_fa,
    startAt: sub.start_at,
    endAt: sub.end_at,
    purchasedAt: sub.purchased_at,
    autoRenew: Boolean(sub.auto_renew),
  };
}

// ============================================================
// Profile Usage
// ============================================================

export function queryProfileUsage(userId: string) {
  const row = readTable<UsageStatsRow>("usage_stats").find((r) => r.user_id === userId);
  if (!row) {
    return {
      dailyRequestsUsed: 0, dailyRequestsTotal: 300,
      tokensUsed: 0, tokensTotal: 1300000,
      documentAnalysesUsed: 0, documentAnalysesTotal: 10,
      contractsGenerated: 0, contractsTotal: 8,
    };
  }
  return {
    dailyRequestsUsed: row.daily_requests_used,
    dailyRequestsTotal: row.daily_requests_total,
    tokensUsed: row.tokens_used,
    tokensTotal: row.tokens_total,
    documentAnalysesUsed: row.document_analyses_used,
    documentAnalysesTotal: row.document_analyses_total,
    contractsGenerated: row.contracts_generated,
    contractsTotal: row.contracts_total,
  };
}

// ============================================================
// Subscription History
// ============================================================

export function querySubscriptionHistory(userId: string): SubscriptionRow[] {
  return readTable<StoredSubscription>("subscriptions")
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))
    .map((r) => ({
      id: r.id,
      planCode: r.plan_code,
      planNameFa: r.plan_name_fa,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      statusFa: r.status_fa,
      startAt: r.start_at,
      endAt: r.end_at,
      purchasedAt: r.purchased_at,
      autoRenew: Boolean(r.auto_renew),
    }));
}

export function createSubscription(params: {
  userId: string;
  planCode: string;
  planNameFa: string;
  amount: number;
  status: string;
  statusFa: string;
  startAt: string;
  endAt: string;
}): StoredSubscription {
  const subs = readTable<StoredSubscription>("subscriptions");
  const sub: StoredSubscription = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    plan_code: params.planCode,
    plan_name_fa: params.planNameFa,
    amount: params.amount,
    currency: "IRT",
    status: params.status,
    status_fa: params.statusFa,
    start_at: params.startAt,
    end_at: params.endAt,
    purchased_at: new Date().toISOString(),
    auto_renew: 1,
  };
  subs.push(sub);
  writeTable("subscriptions", subs);
  return sub;
}

// ============================================================
// History with filters
// ============================================================

export interface QueryHistoryParams {
  userId: string;
  category?: string;
  search?: string;
  type?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export function queryHistory(params: QueryHistoryParams) {
  let items = readTable<ActivityRow>("activities")
    .filter((a) => a.user_id === params.userId);

  if (params.category && params.category !== "all") {
    items = items.filter((a) => a.category === params.category);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.description?.toLowerCase().includes(q) ?? false)
    );
  }
  if (params.type && params.type !== "all") {
    items = items.filter((a) => a.type === params.type);
  }

  const sort = params.sort ?? "newest";
  if (sort === "oldest") items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  else if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, "fa"));
  else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const total = items.length;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  return { items: paged, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

// ============================================================
// Rewards Ledger
// ============================================================
// The ledger is authoritative: balance = SUM(points_delta).
// Idempotency is enforced by unique keys (idempotency_key, and per-event
// uniqueness). Rewards are only created when a rule is enabled.

export function readRewardLedger(userId: string): RewardLedgerEntry[] {
  return readTable<RewardLedgerEntry>("reward_ledger")
    .filter((e) => e.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getRewardBalance(userId: string): number {
  return readTable<RewardLedgerEntry>("reward_ledger")
    .filter((e) => e.user_id === userId)
    .reduce((sum, e) => sum + e.points_delta, 0);
}

/** True if a ledger entry with this idempotency key already exists. */
function ledgerHasIdempotencyKey(key: string): boolean {
  return readTable<RewardLedgerEntry>("reward_ledger").some((e) => e.idempotency_key === key);
}

function ledgerHasUnique(eventType: RewardEventType, userId: string, uniqueKey?: string): boolean {
  const rows = readTable<RewardLedgerEntry>("reward_ledger").filter((e) => e.user_id === userId && e.event_type === eventType);
  if (uniqueKey) return rows.some((e) => (e.metadata as Record<string, unknown>)["uniqueKey"] === uniqueKey);
  return rows.length > 0;
}

export interface GrantRewardResult {
  awarded: boolean;
  points: number;
  entry?: RewardLedgerEntry;
  reason?: "disabled" | "duplicate";
}

/**
 * Grant a reward atomically (single writer per process; the JSON store is
 * read-modify-write within this function). Idempotent via idempotency_key and
 * per-event uniqueness keys.
 */
export function grantReward(params: {
  userId: string;
  eventType: RewardEventType;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  description: string;
  metadata?: Record<string, unknown>;
  /** For once_per_day / once_per_purchase uniqueness (e.g. date string). */
  uniqueKey?: string;
}): GrantRewardResult {
  const rule = getRewardRule(params.eventType);
  if (!rule || !rule.enabled) {
    return { awarded: false, points: 0, reason: "disabled" };
  }

  // Idempotency: same purchase/profile event must never double-award.
  if (ledgerHasIdempotencyKey(params.idempotencyKey)) {
    return { awarded: false, points: 0, reason: "duplicate" };
  }
  if (ledgerHasUnique(params.eventType, params.userId, params.uniqueKey)) {
    return { awarded: false, points: 0, reason: "duplicate" };
  }

  const entry: RewardLedgerEntry = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    event_type: params.eventType,
    points_delta: rule.points,
    source_type: params.sourceType,
    source_id: params.sourceId,
    idempotency_key: params.idempotencyKey,
    description: params.description,
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  const rows = readTable<RewardLedgerEntry>("reward_ledger");
  rows.push(entry);
  writeTable("reward_ledger", rows);

  return { awarded: true, points: rule.points, entry };
}

/** Claim the once-per-day DAILY_VISIT reward (Asia/Tehran day). */
export function claimDailyVisitReward(userId: string): GrantRewardResult {
  const day = tehranDateString();
  return grantReward({
    userId,
    eventType: "DAILY_VISIT",
    idempotencyKey: `daily-visit:${userId}:${day}`,
    sourceType: "system",
    sourceId: "daily-visit",
    description: "امتیاز حضور روزانه",
    uniqueKey: day,
  });
}

/** Award the once-per-account PROFILE_COMPLETED reward (1000 points). */
export function claimProfileCompletedReward(userId: string): GrantRewardResult {
  return grantReward({
    userId,
    eventType: "PROFILE_COMPLETED",
    idempotencyKey: `profile-completed:${userId}`,
    sourceType: "profile",
    sourceId: userId,
    description: "امتیاز تکمیل پروفایل",
  });
}

/** Award a subscription purchase reward (idempotent by purchase/subscription id). */
export function claimPurchaseReward(userId: string, planCode: string, purchaseId: string): GrantRewardResult {
  const eventType = purchaseEventForPlan(planCode);
  if (!eventType) return { awarded: false, points: 0, reason: "disabled" };
  return grantReward({
    userId,
    eventType,
    idempotencyKey: `purchase:${purchaseId}`,
    sourceType: "subscription",
    sourceId: purchaseId,
    description: `امتیاز خرید اشتراک ${planCode}`,
  });
}

// ============================================================
// Dev seed
// ============================================================

let seeded = false;

export function seedDevData(): void {
  if (seeded) return;
  if (process.env.NODE_ENV !== "development") return;

  const users = readTable<DbUser>("users");
  if (users.length > 0) { seeded = true; return; }

  // Seed demo user (password: "123456")
const hash = bcrypt.hashSync("123456", 10);
  const userId = crypto.randomUUID();

  const user: DbUser = {
    id: userId,
    mobile: "09120000003",
    email: "maryam@example.com",
    passwordHash: hash,
    displayName: "مریم محمدی",
    createdAt: new Date().toISOString(),
  };
  writeTable("users", [user]);

  // Seed activities
  const acts: ActivityRow[] = [
    { id: "hist-001", user_id: userId, type: "conversation", title: "مشاوره قرارداد اجاره", status: "active", status_fa: "فعال", description: "گفتگو در مورد حقوق مستأجر و ورود غیرمجاز صاحبخانه", category: "real_estate", category_fa: "املاک", created_at: "2026-07-28T10:00:00Z", updated_at: "2026-07-28T10:30:00Z", archived: 0 },
    { id: "hist-002", user_id: userId, type: "document", title: "قرارداد-اجاره-آپارتمان.pdf", status: "ready", status_fa: "آماده", description: "تحلیل سند اجاره — ۵ یافته شناسایی شد", category: "real_estate", category_fa: "املاک", created_at: "2026-07-27T14:00:00Z", updated_at: "2026-07-27T16:00:00Z", archived: 0 },
    { id: "hist-003", user_id: userId, type: "contract", title: "قرارداد اجاره آپارتمان", status: "generated", status_fa: "تولید شده", description: "پیش‌نویس قرارداد اجاره — نسخه ۲", category: "real_estate", category_fa: "املاک", created_at: "2026-07-30T10:00:00Z", updated_at: "2026-07-30T11:00:00Z", archived: 0 },
    { id: "hist-004", user_id: userId, type: "conversation", title: "مشاوره طلاق توافقی", status: "completed", status_fa: "تکمیل شده", description: "گفتگو در مورد شرایط و مراحل طلاق توافقی", category: "family", category_fa: "خانواده", created_at: "2026-07-20T10:00:00Z", updated_at: "2026-07-25T18:00:00Z", archived: 0 },
    { id: "hist-005", user_id: userId, type: "contract", title: "توافقنامه محرمانگی", status: "under_review", status_fa: "در حال بررسی", description: "NDA بین شرکت الف و شرکت ب", category: "commerce", category_fa: "تجارت", created_at: "2026-07-28T09:00:00Z", updated_at: "2026-07-28T09:30:00Z", archived: 0 },
    { id: "hist-006", user_id: userId, type: "document", title: "قرارداد-پیمانکاری-ساختمان.pdf", status: "ready", status_fa: "آماده", description: "تحلیل قرارداد پیمانکاری — ۳ یافته", category: "commerce", category_fa: "تجارت", created_at: "2026-07-25T09:00:00Z", updated_at: "2026-07-25T11:30:00Z", archived: 0 },
    { id: "hist-007", user_id: userId, type: "conversation", title: "چک برگشتی و نحوه اقدام", status: "archived", status_fa: "بایگانی شده", description: "راهنمایی در مورد اقدامات قانونی چک برگشتی", category: "commerce", category_fa: "تجارت", created_at: "2026-07-10T09:00:00Z", updated_at: "2026-07-15T16:00:00Z", archived: 1 },
    { id: "hist-008", user_id: userId, type: "conversation", title: "شکایت کلاهبرداری اینترنتی", status: "active", status_fa: "فعال", description: "مشاوره در مورد کلاهبرداری آنلاین و نحوه شکایت", category: "other", category_fa: "سایر", created_at: "2026-07-25T11:00:00Z", updated_at: "2026-07-29T09:00:00Z", archived: 0 },
    { id: "hist-009", user_id: userId, type: "document", title: "قرارداد-استخدام-شرکت-فنی.docx", status: "ready", status_fa: "آماده", description: "تحلیل قرارداد استخدام — ۱ یافته", category: "commerce", category_fa: "تجارت", created_at: "2026-07-20T10:00:00Z", updated_at: "2026-07-20T12:00:00Z", archived: 0 },
    { id: "hist-010", user_id: userId, type: "contract", title: "قرارداد مشارکت تجاری", status: "approved", status_fa: "تأیید شده", description: "قرارداد مشارکت — نسخه ۳", category: "commerce", category_fa: "تجارت", created_at: "2026-07-15T10:00:00Z", updated_at: "2026-07-25T16:00:00Z", archived: 0 },
  ];
  writeTable("activities", acts);

  // Seed subscriptions
  const subs: StoredSubscription[] = [
    { id: "subhist-001", user_id: userId, plan_code: "gold", plan_name_fa: "طلا", amount: 2000000, currency: "IRT", status: "active", status_fa: "فعال", start_at: "2026-07-01T00:00:00Z", end_at: "2026-10-01T00:00:00Z", purchased_at: "2026-07-01T00:00:00Z", auto_renew: 1 },
    { id: "subhist-002", user_id: userId, plan_code: "silver", plan_name_fa: "نقره", amount: 900000, currency: "IRT", status: "expired", status_fa: "منقضی", start_at: "2026-05-01T00:00:00Z", end_at: "2026-06-01T00:00:00Z", purchased_at: "2026-05-01T00:00:00Z", auto_renew: 0 },
    { id: "subhist-003", user_id: userId, plan_code: "silver", plan_name_fa: "نقره", amount: 900000, currency: "IRT", status: "expired", status_fa: "منقضی", start_at: "2025-12-01T00:00:00Z", end_at: "2026-01-01T00:00:00Z", purchased_at: "2025-12-01T00:00:00Z", auto_renew: 0 },
  ];
  writeTable("subscriptions", subs);

  // Seed reward ledger — coherent with the seeded gold subscription above
  // (balance = SUM(points_delta) = 1000, matching one GOLD_PURCHASE event).
  const rewardLedger: RewardLedgerEntry[] = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: "SUBSCRIPTION_GOLD_PURCHASED",
      points_delta: 1000,
      source_type: "subscription",
      source_id: "subhist-001",
      idempotency_key: "purchase:subhist-001",
      description: "امتیاز خرید اشتراک gold",
      metadata: {},
      created_at: "2026-07-01T00:00:00Z",
    },
  ];
  writeTable("reward_ledger", rewardLedger);

  // Seed usage stats
  const usage: UsageStatsRow = {
    user_id: userId,
    daily_requests_used: 127, daily_requests_total: 300,
    tokens_used: 850000, tokens_total: 1300000,
    document_analyses_used: 3, document_analyses_total: 10,
    contracts_generated: 1, contracts_total: 8,
  };
  writeTable("usage_stats", [usage]);

  // Seed profile — completionPercent is recomputed on read; store 0 as a
  // placeholder (getProfile recomputes authoritatively).
  const profile: DbProfile = {
    user_id: userId,
    displayName: "مریم محمدی",
    city: "تهران",
    occupation: "وکیل دادگستری",
    avatarUrl: null,
    email: null,
    birthDate: null,
    gender: null,
    userType: null,
    province: null,
    legalInterests: null,
    primaryUseCase: null,
    completionPercent: 0,
  };
  writeTable("profiles", [profile]);

  // Seed preferences
  const preferences: DbPreferences = {
    user_id: userId,
    theme: "light",
    locale: "fa-IR",
    notifications: {
      appointments: true,
      contractExpiry: true,
      lawyerResponse: true,
      paymentStatus: true,
      caseUpdate: true,
      marketing: false,
    },
    privacy: {
      shareUsageData: true,
      allowAiTraining: false,
      storeConversationHistory: true,
      autoMemoryConsent: false,
    },
  };
  writeTable("preferences", [preferences]);

  seeded = true;
}

// Auto-seed on first import in dev
if (process.env.NODE_ENV === "development") {
  seedDevData();
  const demoUser = findUserByMobile(DEMO_USER_MOBILE);
  if (demoUser) seedDemoContent(demoUser.id);
}
