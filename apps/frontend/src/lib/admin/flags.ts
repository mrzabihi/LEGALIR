// ============================================================
// LEGALIR — Feature flags (server-only)
// ============================================================
// Environment-scoped toggles. A flag has four states: on, off, experiment
// (on for a share of traffic) and limited (on for specific plans/orgs or a
// percentage). Flags are seeded once with the real product capabilities and
// can then be edited by an admin; every change is audited by the caller.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import type { FeatureFlag, FeatureFlagStatus } from "@legalir/types";

const TABLE = "feature_flags";

/**
 * The environment this process runs in. A flag only evaluates in a matching
 * environment (see `isFlagEnabled`). Staging/prod map through; anything else
 * falls back to "development" so a local server never mis-scopes a flag.
 */
export function currentEnvironment(): FeatureFlag["environment"] {
  // Read as a plain string: Next narrows NODE_ENV to "development" | "test",
  // which would make the "staging" comparison a compile-time no-op.
  const raw: string = process.env["NODE_ENV"] ?? "";
  if (raw === "production") return "production";
  if (raw === "staging") return "staging";
  return "development";
}

/**
 * The capabilities the product actually ships, seeded as flags. `environment`
 * is taken from the running process so a fresh staging/prod database seeds
 * flags that `isFlagEnabled` will actually evaluate — the previous hard-coded
 * "development" scoped every flag out of any non-dev environment.
 */
function seedRows(): Omit<FeatureFlag, "createdAt" | "updatedAt">[] {
  const environment = currentEnvironment();
  const on = {
    status: "on" as const,
    rolloutPercent: 100,
    allowedPlans: [] as string[],
    allowedOrgIds: [] as string[],
    environment,
    updatedBy: null,
  };
  const off = { ...on, status: "off" as const, rolloutPercent: 0 };
  return [
    { key: "ai_consultation", nameFa: "مشاوره هوش مصنوعی", descriptionFa: "گفت‌وگوی حقوقی مبتنی بر AI", ...on },
    { key: "document_analysis", nameFa: "تحلیل سند", descriptionFa: "تحلیل خودکار اسناد حقوقی", ...on },
    { key: "contract_review", nameFa: "بررسی قرارداد", descriptionFa: "بازبینی و ارزیابی ریسک قرارداد", ...on },
    { key: "contract_generation", nameFa: "تولید قرارداد", descriptionFa: "ساخت قرارداد از قالب‌های تأییدشده", ...on },
    { key: "formal_letter", nameFa: "تولید اظهارنامه", descriptionFa: "تنظیم اظهارنامه و نامه رسمی", ...on },
    { key: "calculators", nameFa: "محاسبه‌گرهای حقوقی", descriptionFa: "محاسبه‌های فرمولی مستقل از AI", ...on },
    { key: "lawyer_referral", nameFa: "ارجاع به وکیل", descriptionFa: "ارجاع درخواست به وکلای منتخب", ...on },
    { key: "case_management", nameFa: "پرونده و پیگیری", descriptionFa: "مدیریت پرونده و مهلت‌ها", ...on },
    { key: "legal_library", nameFa: "کتابخانه حقوقی", descriptionFa: "منابع و متون حقوقی", ...on },
    { key: "notifications_inapp", nameFa: "اعلان درون‌برنامه‌ای", descriptionFa: "مرکز اعلان‌ها", ...on },
    { key: "export_data", nameFa: "خروجی گرفتن از داده", descriptionFa: "دریافت بسته ZIP از داده‌های کاربر", ...off },
    { key: "voice_video_consult", nameFa: "مشاوره صوتی/تصویری", descriptionFa: "نیازمند اتصال ارائه‌دهنده ویدیو", ...off },
    // --- Judicial documents family -------------------------------------
    // The four drafting services ship on. The two provider-dependent ones ship
    // OFF: their service config status is `soon` and their requirement is
    // unconfigured, so flipping the flag alone can never make them look live.
    { key: "judicial_statement", nameFa: "اظهارنامه قضایی", descriptionFa: "تنظیم پیش‌نویس اظهارنامه با هوش مصنوعی", ...on },
    { key: "judicial_brief", nameFa: "لایحه", descriptionFa: "تنظیم پیش‌نویس لایحه با هوش مصنوعی", ...on },
    { key: "judicial_petition", nameFa: "دادخواست حقوقی", descriptionFa: "تنظیم پیش‌نویس دادخواست با هوش مصنوعی", ...on },
    { key: "judicial_complaint", nameFa: "شکواییه کیفری", descriptionFa: "تنظیم پیش‌نویس شکواییه با هوش مصنوعی", ...on },
    { key: "judicial_criminal_record", nameFa: "گواهی عدم سوءپیشینه", descriptionFa: "نیازمند اتصال رسمی به سامانهٔ صدور گواهی", ...off },
    { key: "judicial_credit_check", nameFa: "استعلام اعتبار معاملاتی", descriptionFa: "نیازمند رضایت صاحب داده و ارائه‌دهندهٔ استعلام", ...off },
  ];
}

function seed(): FeatureFlag[] {
  const now = new Date().toISOString();
  const rows: FeatureFlag[] = seedRows().map((f) => ({ ...f, createdAt: now, updatedAt: now }));
  writeTable(TABLE, rows);
  return rows;
}

/**
 * All flags, seeding the defaults on first access.
 *
 * ADDITIVE for an existing database: when the product ships a NEW capability
 * flag, a database that was seeded earlier must still gain it. Existing rows
 * are never rewritten or dropped — only seed keys that are missing are
 * appended — so an operator's edits to an existing flag always survive.
 */
export function listFlags(): FeatureFlag[] {
  const rows = readTable<FeatureFlag>(TABLE);
  if (rows.length === 0) return seed();

  const present = new Set(rows.map((r) => r.key));
  const now = new Date().toISOString();
  const missing = seedRows().filter((f) => !present.has(f.key));
  if (missing.length === 0) return rows;

  const next = [...rows, ...missing.map((f) => ({ ...f, createdAt: now, updatedAt: now }))];
  writeTable(TABLE, next);
  return next;
}

export function getFlag(key: string): FeatureFlag | undefined {
  return listFlags().find((f) => f.key === key);
}

export function updateFlag(
  key: string,
  updates: Partial<Pick<FeatureFlag, "status" | "rolloutPercent" | "allowedPlans" | "allowedOrgIds" | "nameFa" | "descriptionFa">>,
  changedBy: string
): FeatureFlag | undefined {
  const rows = listFlags();
  const idx = rows.findIndex((f) => f.key === key);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, ...updates, updatedBy: changedBy, updatedAt: new Date().toISOString() };
  writeTable(TABLE, rows);
  return rows[idx];
}

/** The caller facts a flag is evaluated against. */
export interface FlagContext {
  env: string;
  planCode?: string | null;
  orgId?: string | null;
  bucket?: number;
}

/**
 * The single source of truth for flag evaluation, used by both the admin
 * panel and any in-app gate. `env` must match the flag's environment.
 */
export function isFlagEnabled(key: string, ctx: FlagContext): boolean {
  const flag = getFlag(key);
  if (!flag) return false;
  if (flag.environment !== ctx.env) return false;
  switch (flag.status) {
    case "on":
      return true;
    case "off":
      return false;
    case "experiment":
    case "limited": {
      if (ctx.planCode && flag.allowedPlans.length > 0 && flag.allowedPlans.includes(ctx.planCode)) {
        return true;
      }
      if (ctx.orgId && flag.allowedOrgIds.includes(ctx.orgId)) return true;
      const bucket = ctx.bucket ?? 0;
      return bucket < flag.rolloutPercent;
    }
    default:
      return false;
  }
}

export const FLAG_STATUS_FA: Record<FeatureFlagStatus, string> = {
  on: "فعال",
  off: "خاموش",
  experiment: "آزمایشی",
  limited: "محدود",
};
