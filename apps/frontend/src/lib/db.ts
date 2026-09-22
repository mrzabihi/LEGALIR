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
  getEnergyRule,
  tehranDateString,
  purchaseEventForPlan,
  type RewardEventType,
} from "./rewards";
import { seedDemoContent, seedLawContent, seedDemoCases, DEMO_USER_MOBILE } from "./demo-seed";
import { seedPropertyContracts } from "./contracts/seed";
import { listRenewalReminders } from "./contracts/db";
import { seedDemoLawyers } from "./lawyer-seed";
import { getPlanByCode } from "./usage/plans";
import type {
  NotificationItem,
  PlatformAccountType,
  PlatformRole,
  PlanEntitlementSnapshot,
  RegistrationIntent,
  RegistrationOrigin,
  OnboardingType,
  OnboardingStatus,
} from "@legalir/types";

const DB_DIR = path.resolve(process.cwd(), ".data");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// ------------------------------------------------------------
// Read cache
// ------------------------------------------------------------
// Tables used to be re-read and re-parsed from disk on every call —
// the session table alone is >100KB, and a single page load touches
// several tables, so this dominated request latency. All writes go
// through `writeTable` in this process, so an mtime+size check is
// enough to trust the cached parse; `writeTable` primes the entry so
// a write can never leave a stale parse behind.
const tableCache = new Map<string, { mtimeMs: number; size: number; data: unknown[] }>();

export function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    tableCache.delete(name);
    return [];
  }
  const cached = tableCache.get(name);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data as T[];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
    return data;
  } catch {
    return [];
  }
}

export function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  try {
    const stat = fs.statSync(file);
    tableCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  } catch {
    tableCache.delete(name);
  }
}

// ============================================================
// Types
// ============================================================

/**
 * Account type — the legal nature of the account holder.
 * `individual` (شخص حقیقی) → `legal` (شخص حقوقی) is a one-way transition:
 * once an account is `legal` it can never return to `individual`.
 */
export type AccountType = "individual" | "legal";

export interface DbUser {
  id: string;
  mobile: string;
  email: string | null;
  passwordHash: string;
  displayName: string | null;
  /** Absent on legacy rows — treat as "individual". */
  accountType?: AccountType;
  /**
   * Platform account type (PERSONAL | LAWYER | BUSINESS). Absent on
   * legacy rows — derived from `accountType` via `normalizeAccountType`.
   * Kept alongside the legacy field so existing rows never break.
   */
  platformAccountType?: PlatformAccountType;
  /** RBAC role. Absent on legacy rows — treated as "USER". */
  role?: PlatformRole;
  /** The organization the user belongs to, when org-scoped. */
  orgId?: string | null;
  /**
   * The entry point chosen at signup (PERSONAL | ORGANIZATION | LAWYER).
   * Absent on legacy rows — treated as LEGACY. Analytics/UX only; NEVER
   * used for authorization.
   */
  registrationOrigin?: RegistrationOrigin;
  /** The onboarding track the user is on. Absent on legacy rows. */
  onboardingType?: OnboardingType;
  /** Progress through that track. Absent on legacy rows. */
  onboardingStatus?: OnboardingStatus;
  createdAt: string;
}

export interface DbSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  /** Last time this session was seen on a request (ISO). */
  lastActiveAt?: string;
  /** Raw User-Agent header captured at creation. */
  userAgent?: string | null;
  /** Best-effort client IP captured at creation. */
  ip?: string | null;
}

export interface ActivityRow {
  id: string;
  user_id: string;
  type: "conversation" | "document" | "contract" | "subscription" | "case";
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
  /** Entitlements frozen at purchase time (absent on legacy rows). */
  plan_snapshot?: PlanEntitlementSnapshot;
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
  /** Tehran calendar day (YYYY-MM-DD) the daily counter belongs to. */
  usage_day?: string;
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
  /** Whether the profile-completion incentive prompt should be shown.
   *  Defaults to true; a user can explicitly suppress it (persistent preference). */
  showProfileCompletionPrompt: boolean;
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
  /**
   * The registration entry point. Defaults to PERSONAL. The intent only
   * seeds the onboarding track — it never grants a role or org access.
   */
  registrationIntent?: RegistrationIntent;
}): DbUser {
  const users = readTable<DbUser>("users");
  const intent: RegistrationIntent = params.registrationIntent ?? "PERSONAL";
  const user: DbUser = {
    id: crypto.randomUUID(),
    mobile: params.mobile,
    email: params.email ?? null,
    passwordHash: params.passwordHash,
    displayName: params.displayName ?? null,
    accountType: "individual",
    platformAccountType: "PERSONAL",
    role: "USER",
    orgId: null,
    registrationOrigin: intent,
    onboardingType: intent,
    onboardingStatus: "NOT_STARTED",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeTable("users", users);
  return user;
}

/** Set the onboarding progress for a user. */
export function setOnboardingStatus(
  userId: string,
  status: OnboardingStatus
): DbUser | undefined {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return undefined;
  user.onboardingStatus = status;
  writeTable("users", users);
  return user;
}

/** The user's registration origin, defaulting legacy rows to LEGACY. */
export function getRegistrationOrigin(userId: string): RegistrationOrigin {
  return findUserById(userId)?.registrationOrigin ?? "LEGACY";
}

/**
 * Set the platform account type. Unlike the legacy one-way
 * `individual → legal` conversion, the platform type may move between
 * PERSONAL and BUSINESS freely; LAWYER is granted only through the
 * lawyer-application flow (which also sets the LAWYER role).
 *
 * The legacy `accountType` field is kept in sync so older code paths
 * that still read it observe a consistent value.
 */
export function setPlatformAccountType(
  userId: string,
  type: PlatformAccountType
): DbUser | undefined {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return undefined;
  user.platformAccountType = type;
  // Keep the legacy field coherent: BUSINESS maps to "legal".
  if (type === "BUSINESS") user.accountType = "legal";
  else if (type === "PERSONAL") user.accountType = "individual";
  writeTable("users", users);
  return user;
}

/** Set the RBAC role on a user row. */
export function setUserRole(userId: string, role: PlatformRole): DbUser | undefined {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return undefined;
  user.role = role;
  writeTable("users", users);
  return user;
}

/** The account type, defaulting legacy rows (no field) to "individual". */
export function getAccountType(userId: string): AccountType {
  return findUserById(userId)?.accountType ?? "individual";
}

export interface ConvertAccountResult {
  ok: boolean;
  accountType: AccountType;
  reason?: "not_found" | "already_legal";
}

/**
 * Convert an account to `legal`. One-way: a `legal` account can never be
 * converted back. Enforced here (backend), not just in the UI.
 */
export function convertAccountToLegal(userId: string): ConvertAccountResult {
  const users = readTable<DbUser>("users");
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false, accountType: "individual", reason: "not_found" };
  if (user.accountType === "legal") {
    return { ok: false, accountType: "legal", reason: "already_legal" };
  }
  user.accountType = "legal";
  writeTable("users", users);
  return { ok: true, accountType: "legal" };
}

// ============================================================
// Session operations
// ============================================================

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null }
): DbSession {
  const sessions = readTable<DbSession>("sessions");
  const now = new Date().toISOString();
  const session: DbSession = {
    id: crypto.randomUUID(),
    userId,
    createdAt: now,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
    lastActiveAt: now,
    userAgent: meta?.userAgent ?? null,
    ip: meta?.ip ?? null,
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

/** All non-expired sessions for a user, newest activity first. */
export function listSessionsForUser(userId: string): DbSession[] {
  const now = new Date().toISOString();
  return readTable<DbSession>("sessions")
    .filter((s) => s.userId === userId && s.expiresAt > now)
    .sort((a, b) => (b.lastActiveAt ?? b.createdAt).localeCompare(a.lastActiveAt ?? a.createdAt));
}

/** Bump a session's last-active timestamp (best-effort, throttled by caller). */
export function touchSession(sessionId: string): void {
  const sessions = readTable<DbSession>("sessions");
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.lastActiveAt = new Date().toISOString();
  writeTable("sessions", sessions);
}

/**
 * Revoke a single session, scoped to its owner. Returns false when the
 * session does not exist or belongs to another user (authorization).
 */
export function revokeSession(userId: string, sessionId: string): boolean {
  const sessions = readTable<DbSession>("sessions");
  const target = sessions.find((s) => s.id === sessionId);
  if (!target || target.userId !== userId) return false;
  writeTable(
    "sessions",
    sessions.filter((s) => s.id !== sessionId)
  );
  return true;
}

/** Revoke every session for a user except the one provided (keep current). */
export function revokeOtherSessions(userId: string, keepSessionId: string): number {
  const sessions = readTable<DbSession>("sessions");
  const remaining = sessions.filter((s) => !(s.userId === userId && s.id !== keepSessionId));
  const removed = sessions.length - remaining.length;
  writeTable("sessions", remaining);
  return removed;
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
    showProfileCompletionPrompt: true,
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
      showProfileCompletionPrompt: updates.showProfileCompletionPrompt ?? true,
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
// Daily request quota
// ============================================================
// The daily allowance is derived from the user's ACTIVE plan (not a
// hard-coded 300). Usage resets at Tehran midnight. Every real action
// (chat message, upload, analysis, contract generation) consumes one
// unit from the day's allowance.

/** Free-tier allowance when the user has no active subscription. */
export const FREE_DAILY_REQUESTS = 10;

/**
 * The daily request allowance for the user's current plan.
 *
 * The number is read from the plan catalog (`subscription_plans`) — the
 * single source of truth — never from a hard-coded copy. A plan edited by
 * an admin is reflected here immediately.
 */
export function dailyRequestAllowance(userId: string): number {
  const sub = queryActiveSubscription(userId);
  if (!sub) return FREE_DAILY_REQUESTS;
  const plan = getPlanByCode(sub.planCode);
  return plan?.dailyRequestLimit ?? FREE_DAILY_REQUESTS;
}

/** True when the user has a subscription row that has already ended. */
export function hasExpiredSubscription(userId: string): boolean {
  const subs = readTable<StoredSubscription>("subscriptions").filter(
    (s) => s.user_id === userId
  );
  if (subs.length === 0) return false;
  const now = Date.now();
  const hasActive = subs.some(
    (s) => s.status === "active" && new Date(s.end_at).getTime() > now
  );
  if (hasActive) return false;
  // Had at least one subscription, none currently active → expired.
  return subs.some((s) => new Date(s.end_at).getTime() <= now);
}

export interface DailyQuota {
  used: number;
  total: number;
  remaining: number;
  /** ISO timestamp of the next reset (Tehran midnight), from the server clock. */
  resetAt: string;
  /** True when the day's allowance is fully consumed. */
  exhausted: boolean;
  /** True when the user's subscription has lapsed. */
  subscriptionExpired: boolean;
}

/** Next Tehran-midnight boundary as an ISO string (server clock). */
export function nextTehranMidnight(now: Date = new Date()): string {
  // Tehran is UTC+03:30 (no DST since 2022).
  const tehranMs = now.getTime() + 3.5 * 3600_000;
  const dayMs = 24 * 3600_000;
  const nextMidnightTehran = Math.floor(tehranMs / dayMs) * dayMs + dayMs;
  return new Date(nextMidnightTehran - 3.5 * 3600_000).toISOString();
}

/**
 * Read the user's daily quota, resetting the counter when the stored
 * `usage_day` differs from the current Tehran day.
 */
export function queryDailyQuota(userId: string): DailyQuota {
  const rows = readTable<UsageStatsRow>("usage_stats");
  const idx = rows.findIndex((r) => r.user_id === userId);
  const today = tehranDateString();
  const total = dailyRequestAllowance(userId);

  let used = 0;
  if (idx !== -1) {
    const row = rows[idx]!;
    if (row.usage_day !== today) {
      row.daily_requests_used = 0;
      row.usage_day = today;
      writeTable("usage_stats", rows);
    }
    used = row.daily_requests_used;
  }

  const remaining = Math.max(0, total - used);
  return {
    used,
    total,
    remaining,
    resetAt: nextTehranMidnight(),
    exhausted: remaining <= 0,
    subscriptionExpired: hasExpiredSubscription(userId),
  };
}

/**
 * Consume one unit of the day's allowance. Returns the updated quota.
 * Resets first if the Tehran day has rolled over.
 */
export function consumeDailyRequest(userId: string): DailyQuota {
  const rows = readTable<UsageStatsRow>("usage_stats");
  const today = tehranDateString();
  const total = dailyRequestAllowance(userId);
  let idx = rows.findIndex((r) => r.user_id === userId);

  if (idx === -1) {
    rows.push({
      user_id: userId,
      daily_requests_used: 0,
      daily_requests_total: total,
      tokens_used: 0,
      tokens_total: 1300000,
      document_analyses_used: 0,
      document_analyses_total: 10,
      contracts_generated: 0,
      contracts_total: 8,
      usage_day: today,
    });
    idx = rows.length - 1;
  }

  const row = rows[idx]!;
  if (row.usage_day !== today) {
    row.daily_requests_used = 0;
    row.usage_day = today;
  }
  row.daily_requests_total = total;
  row.daily_requests_used += 1;
  writeTable("usage_stats", rows);

  const remaining = Math.max(0, total - row.daily_requests_used);
  return {
    used: row.daily_requests_used,
    total,
    remaining,
    resetAt: nextTehranMidnight(),
    exhausted: remaining <= 0,
    subscriptionExpired: hasExpiredSubscription(userId),
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
  /** Entitlements frozen at purchase time. */
  planSnapshot?: PlanEntitlementSnapshot;
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
    plan_snapshot: params.planSnapshot,
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
// Activity recording (write path)
// ============================================================
// Every real user action is appended here so the history section is a
// complete, durable log. Rows are keyed by a stable `sourceId` so that
// repeated updates to the same entity (e.g. a contract regenerated twice)
// update the existing row instead of creating duplicates.

export interface RecordActivityInput {
  userId: string;
  type: ActivityRow["type"];
  title: string;
  status: string;
  statusFa: string;
  description?: string | null;
  category?: string | null;
  categoryFa?: string | null;
  /** Stable id of the underlying entity; used to upsert instead of duplicate. */
  sourceId?: string;
}

export function recordActivity(input: RecordActivityInput): ActivityRow {
  const rows = readTable<ActivityRow>("activities");
  const now = new Date().toISOString();

  const existing = input.sourceId
    ? rows.find((r) => r.id === input.sourceId && r.user_id === input.userId)
    : undefined;

  if (existing) {
    existing.title = input.title;
    existing.status = input.status;
    existing.status_fa = input.statusFa;
    existing.description = input.description ?? existing.description;
    existing.category = input.category ?? existing.category;
    existing.category_fa = input.categoryFa ?? existing.category_fa;
    existing.updated_at = now;
    existing.archived = 0;
    writeTable("activities", rows);
    return existing;
  }

  const row: ActivityRow = {
    id: input.sourceId ?? crypto.randomUUID(),
    user_id: input.userId,
    type: input.type,
    title: input.title,
    status: input.status,
    status_fa: input.statusFa,
    description: input.description ?? null,
    category: input.category ?? null,
    category_fa: input.categoryFa ?? null,
    created_at: now,
    updated_at: now,
    archived: 0,
  };
  rows.push(row);
  writeTable("activities", rows);
  return row;
}

/** Remove an activity row (used when the underlying entity is deleted). */
export function removeActivity(userId: string, sourceId: string): void {
  const rows = readTable<ActivityRow>("activities");
  const next = rows.filter((r) => !(r.id === sourceId && r.user_id === userId));
  if (next.length !== rows.length) writeTable("activities", next);
}

/** Toggle the archived flag on an activity row. Returns the updated row. */
export function archiveActivity(
  userId: string,
  sourceId: string,
  archived: boolean
): ActivityRow | null {
  const rows = readTable<ActivityRow>("activities");
  const row = rows.find((r) => r.id === sourceId && r.user_id === userId);
  if (!row) return null;
  row.archived = archived ? 1 : 0;
  row.updated_at = new Date().toISOString();
  writeTable("activities", rows);
  return row;
}

// ============================================================
// Conversations (shared read/write for the history + chat routes)
// ============================================================

export interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  status: string;
  riskLevel: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export function readConversations(): StoredConversation[] {
  return readTable<StoredConversation>("conversations");
}

export function writeConversations(data: StoredConversation[]): void {
  writeTable("conversations", data);
}

/**
 * Mark a conversation as just-active: bumps `updatedAt` and increments
 * `messageCount`. Called on every chat turn so the history list reflects
 * real activity ordering.
 */
export function touchConversation(userId: string, conversationId: string): void {
  const all = readConversations();
  const conv = all.find((c) => c.id === conversationId && c.userId === userId);
  if (!conv) return;
  conv.updatedAt = new Date().toISOString();
  conv.messageCount = (conv.messageCount ?? 0) + 1;
  writeConversations(all);
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

export interface PointsAccount {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  transactionCount: number;
}

/**
 * Derive the points account aggregates from the ledger. The ledger is the
 * single source of truth — balance is never stored separately, so it can
 * never drift from the transactions that produced it.
 */
export function getPointsAccount(userId: string): PointsAccount {
  const rows = readTable<RewardLedgerEntry>("reward_ledger").filter(
    (e) => e.user_id === userId
  );
  let balance = 0;
  let lifetimeEarned = 0;
  let lifetimeSpent = 0;
  for (const e of rows) {
    balance += e.points_delta;
    if (e.points_delta >= 0) lifetimeEarned += e.points_delta;
    else lifetimeSpent += -e.points_delta;
  }
  return { balance, lifetimeEarned, lifetimeSpent, transactionCount: rows.length };
}

/** True when the user can afford `amount` points (used to gate redemption). */
export function canSpendPoints(userId: string, amount: number): boolean {
  return getRewardBalance(userId) >= amount;
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
// Energy spend
// ============================================================
// Every processed request costs energy, regardless of which action
// triggered it. The spend is written to the same ledger as awards, so
// `getRewardBalance` (SUM of points_delta) stays the single balance.

export interface SpendEnergyResult {
  spent: boolean;
  points: number;
  balance: number;
  entry?: RewardLedgerEntry;
  /** Why the spend did not happen (when `spent` is false). */
  reason?: "duplicate" | "insufficient_balance" | "no_rule";
}

/**
 * Deduct the per-request energy cost from the user's balance.
 *
 * `sourceId` must uniquely identify the request (e.g. the message id,
 * upload id or contract id) — it forms the idempotency key so a retried
 * request can never be charged twice.
 *
 * Soft floor: the balance is never allowed to go negative. When the user
 * cannot afford the cost, no ledger entry is written and the request is
 * still allowed to proceed (the daily quota remains the primary gate).
 */
export function spendEnergy(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): SpendEnergyResult {
  const rule = getEnergyRule("REQUEST_CONSUMED");
  if (!rule) {
    return { spent: false, points: 0, balance: getRewardBalance(params.userId), reason: "no_rule" };
  }

  const idempotencyKey = `energy:${params.sourceType}:${params.sourceId}`;
  if (ledgerHasIdempotencyKey(idempotencyKey)) {
    return { spent: false, points: 0, balance: getRewardBalance(params.userId), reason: "duplicate" };
  }

  // Soft floor — never let the balance cross below zero.
  const currentBalance = getRewardBalance(params.userId);
  if (currentBalance + rule.points < 0) {
    return {
      spent: false,
      points: 0,
      balance: currentBalance,
      reason: "insufficient_balance",
    };
  }

  const entry: RewardLedgerEntry = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    event_type: rule.eventType,
    points_delta: rule.points,
    source_type: params.sourceType,
    source_id: params.sourceId,
    idempotency_key: idempotencyKey,
    description: params.description ?? rule.descriptionFa,
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  const rows = readTable<RewardLedgerEntry>("reward_ledger");
  rows.push(entry);
  writeTable("reward_ledger", rows);

  return {
    spent: true,
    points: rule.points,
    balance: getRewardBalance(params.userId),
    entry,
  };
}

/**
 * Spend an explicit number of reward points. Used by the Entitlement & Usage
 * Engine as the fallback when the daily subscription credit is exhausted and
 * the product has enabled reward spending. Idempotent per
 * (sourceType, sourceId) so a retried request can never double-charge.
 */
export function spendRewardPoints(params: {
  userId: string;
  points: number;
  sourceType: string;
  sourceId: string;
  description?: string;
}): SpendEnergyResult {
  const idempotencyKey = `reward-spend:${params.sourceType}:${params.sourceId}`;
  if (ledgerHasIdempotencyKey(idempotencyKey)) {
    return {
      spent: false,
      points: 0,
      balance: getRewardBalance(params.userId),
      reason: "duplicate",
    };
  }

  const currentBalance = getRewardBalance(params.userId);
  if (currentBalance < params.points) {
    return {
      spent: false,
      points: 0,
      balance: currentBalance,
      reason: "insufficient_balance",
    };
  }

  const entry: RewardLedgerEntry = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    event_type: "REQUEST_CONSUMED",
    points_delta: -params.points,
    source_type: params.sourceType,
    source_id: params.sourceId,
    idempotency_key: idempotencyKey,
    description: params.description ?? "مصرف امتیاز",
    metadata: {},
    created_at: new Date().toISOString(),
  };

  const rows = readTable<RewardLedgerEntry>("reward_ledger");
  rows.push(entry);
  writeTable("reward_ledger", rows);

  return {
    spent: true,
    points: -params.points,
    balance: getRewardBalance(params.userId),
    entry,
  };
}

// ============================================================
// Notification Center
// ============================================================
// The feed is DERIVED, not stored. Every item comes from a real system
// event that already exists elsewhere in the database:
//
//   reward_ledger  → category "points"    (the points history, normalized)
//   activities     → category "personal"  (the user's own work events)
//   catalog below  → category "public"    (LEGALIR-wide announcements)
//
// Only the read receipts are persisted, keyed by the item's stable id.
// This keeps a single source of truth per event and guarantees the unread
// count can never drift from the feed it describes.

export interface NotificationReadRow {
  user_id: string;
  notification_id: string;
  read_at: string;
}

/**
 * Product announcements. These are editorial content shipped with the
 * build — not user data — so they live here as a static catalog rather
 * than in a table. `id` is stable and must never be reused.
 */
interface AnnouncementDef {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  href?: string;
  actionLabel?: string;
}

const ANNOUNCEMENTS: AnnouncementDef[] = [
  {
    id: "ann:legal-library-launch",
    title: "کتابخانه حقوقی LEGALIR منتشر شد",
    message: "دسترسی رایگان به قوانین، آرای وحدت رویه و راهنماهای حقوقی.",
    createdAt: "2026-09-10T08:00:00.000Z",
    href: "/legal-library",
    actionLabel: "مشاهده کتابخانه",
  },
  {
    id: "ann:legal-calculators",
    title: "محاسبه‌گرهای حقوقی در دسترس است",
    message: "دیه، مهریه، هزینه دادرسی، عیدی و سنوات را سریع محاسبه کنید.",
    createdAt: "2026-09-05T08:00:00.000Z",
    href: "/calculators",
    actionLabel: "ورود به محاسبه‌گرها",
  },
];

/** Map a reward event to a human label when the ledger description is thin. */
const REWARD_EVENT_FA: Record<string, string> = {
  PROFILE_COMPLETED: "تکمیل پروفایل",
  DAILY_VISIT: "ورود روزانه",
  REFERRAL_COMPLETED: "دعوت از دوستان",
  SUBSCRIPTION_SILVER_PURCHASED: "خرید اشتراک نقره‌ای",
  SUBSCRIPTION_GOLD_PURCHASED: "خرید اشتراک طلایی",
  SUBSCRIPTION_DIAMOND_PURCHASED: "خرید اشتراک الماسی",
  REQUEST_CONSUMED: "استفاده از سرویس",
};

/** Where an activity type deep-links to. Mirrors the dashboard widget map. */
const ACTIVITY_HREF: Record<ActivityRow["type"], string> = {
  conversation: "/chat",
  document: "/documents",
  contract: "/contracts",
  subscription: "/subscription",
  case: "/cases",
};

function readNotificationReads(userId: string): NotificationReadRow[] {
  return readTable<NotificationReadRow>("notification_reads").filter(
    (r) => r.user_id === userId
  );
}

/**
 * Build the canonical notification feed for a user, newest first.
 * Pure derivation — calling this twice yields identical ids, so read
 * receipts stay valid across requests.
 */
export function deriveNotifications(userId: string): NotificationItem[] {
  const readIds = new Set(readNotificationReads(userId).map((r) => r.notification_id));
  const items: NotificationItem[] = [];

  // --- Points events (the existing ledger, normalized) ---
  for (const entry of readRewardLedger(userId)) {
    const positive = entry.points_delta >= 0;
    items.push({
      id: `points:${entry.id}`,
      category: "points",
      tone: positive ? "success" : "warning",
      title: entry.description || REWARD_EVENT_FA[entry.event_type] || "تغییر امتیاز",
      message: REWARD_EVENT_FA[entry.event_type],
      createdAt: entry.created_at,
      read: readIds.has(`points:${entry.id}`),
      href: "/points",
      actionLabel: "مشاهده امتیازها",
      pointsDelta: entry.points_delta,
    });
  }

  // --- Personal events (the user's own activities) ---
  for (const activity of readTable<ActivityRow>("activities")) {
    if (activity.user_id !== userId || activity.archived) continue;
    const id = `activity:${activity.id}`;
    items.push({
      id,
      category: "personal",
      tone: activity.status === "failed" ? "error" : "neutral",
      title: activity.title,
      message: activity.status_fa || activity.description || undefined,
      createdAt: activity.updated_at,
      read: readIds.has(id),
      href: ACTIVITY_HREF[activity.type],
    });
  }

  // --- Contract renewal reminders (derived from the contract term) ---
  // Only when the user has not switched the `contractExpiry` preference off.
  if (getPreferences(userId).notifications.contractExpiry) {
    for (const reminder of listRenewalReminders(userId)) {
      const id = `renewal:${reminder.contractId}:${reminder.endDate}`;
      items.push({
        id,
        category: "personal",
        tone: reminder.expired ? "error" : "warning",
        title: reminder.expired
          ? `قرارداد ${reminder.referenceCode} منقضی شده است`
          : `قرارداد ${reminder.referenceCode} در آستانه پایان است`,
        message: reminder.expired
          ? `مدت اجاره در ${reminder.endDate} به پایان رسیده است. برای تمدید یا تخلیه اقدام کنید.`
          : `${reminder.daysRemaining} روز تا پایان مدت اجاره باقی مانده است.`,
        createdAt: reminder.endDate,
        read: readIds.has(id),
        href: `/contracts/${reminder.contractId}`,
        actionLabel: "مشاهده قرارداد",
      });
    }
  }

  // --- Public announcements (static catalog) ---
  for (const ann of ANNOUNCEMENTS) {
    items.push({
      id: ann.id,
      category: "public",
      tone: "neutral",
      title: ann.title,
      message: ann.message,
      createdAt: ann.createdAt,
      read: readIds.has(ann.id),
      href: ann.href,
      actionLabel: ann.actionLabel,
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadNotificationCount(userId: string): number {
  return deriveNotifications(userId).filter((n) => !n.read).length;
}

/** Mark one notification read. Idempotent — re-reading never duplicates. */
export function markNotificationRead(userId: string, notificationId: string): void {
  const rows = readTable<NotificationReadRow>("notification_reads");
  if (rows.some((r) => r.user_id === userId && r.notification_id === notificationId)) {
    return;
  }
  rows.push({
    user_id: userId,
    notification_id: notificationId,
    read_at: new Date().toISOString(),
  });
  writeTable("notification_reads", rows);
}

/** Mark every currently-derived notification read. Returns how many changed. */
export function markAllNotificationsRead(userId: string): number {
  const rows = readTable<NotificationReadRow>("notification_reads");
  const existing = new Set(
    rows.filter((r) => r.user_id === userId).map((r) => r.notification_id)
  );
  const now = new Date().toISOString();
  let changed = 0;
  for (const item of deriveNotifications(userId)) {
    if (existing.has(item.id)) continue;
    rows.push({ user_id: userId, notification_id: item.id, read_at: now });
    changed += 1;
  }
  if (changed > 0) writeTable("notification_reads", rows);
  return changed;
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
    accountType: "individual",
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
    usage_day: tehranDateString(),
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
    showProfileCompletionPrompt: true,
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
  if (demoUser) {
    seedDemoContent(demoUser.id);
    seedLawContent(demoUser.id);
    seedDemoCases(demoUser.id);
    seedPropertyContracts(demoUser.id);
    seedDemoLawyers();
  }
}
