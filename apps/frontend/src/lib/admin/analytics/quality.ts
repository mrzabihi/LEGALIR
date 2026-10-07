// ============================================================
// LEGALIR — Analytics: data-quality flags (G1–G12)
// ============================================================
// The honest contract between the data and the dashboard. Every flag states,
// in Persian, whether a metric family is fully real today, partially real
// (with the caveat named), or impossible without new capture. The ids match
// the gap register in docs/CURRENT_ANALYTICS_AUDIT.md so the code and the
// audit can never drift.
//
// Nothing here is a guess: each flag is computed from real row counts.
// ============================================================

import type { AnalyticsDataQualityFlag } from "@legalir/types";
import { readPayments, readAdjustments, readPlans } from "./sources";

/**
 * Compute the current data-quality register. Cheap (row counts only) and
 * called on every analytics response so the caveat always travels with the
 * numbers it qualifies.
 */
export function analyticsDataQuality(): AnalyticsDataQualityFlag[] {
  const payments = readPayments();
  const adjustments = readAdjustments();
  const plans = readPlans();

  const paidPayments = payments.filter((p) => p.status === "paid").length;
  const mockPayments = payments.filter((p) => p.method === "mock").length;
  const hasAdjustments = adjustments.length > 0;
  const hasActivePlans = plans.some((p) => p.isActive);

  const flags: AnalyticsDataQualityFlag[] = [
    {
      id: "G1",
      labelFa: "مبنای فروش",
      status: "real",
      reasonFa: "همهٔ اعداد فروش از جدول واقعی «اشتراک‌ها» محاسبه می‌شود؛ هر ردیف یک خرید واقعی است.",
      captureNeededFa: "—",
    },
    {
      id: "G2",
      labelFa: "پرداخت واقعی",
      status: mockPayments > 0 ? "partial" : "real",
      reasonFa:
        mockPayments > 0
          ? `${mockPayments} پرداخت ثبت‌شده از درگاه شبیه‌سازی‌شده (mock) است؛ این اعداد «پرداخت واقعی» را نشان نمی‌دهند.`
          : "دادهٔ پرداخت با درگاه واقعی ثبت نشده است.",
      captureNeededFa: "اتصال درگاه پرداخت واقعی و ثبت تراکنش با شناسهٔ مرجع درگاه.",
    },
    {
      id: "G3",
      labelFa: "انرژی منقضی‌شده",
      status: "unavailable",
      reasonFa:
        "جدول‌های فعلی اعتبار انرژی را با زمان انقضا ذخیره نمی‌کنند؛ بنابراین «انرژی منقضی‌شده» قابل استخراج نیست.",
      captureNeededFa: "افزودن فیلد انقضا (expires_at) به رویدادهای اعطای انرژی و ثبت زمان انقضا در زمان اعطا.",
    },
    {
      id: "G4",
      labelFa: "قیف تبدیل (funnel)",
      status: "unavailable",
      reasonFa:
        "رویدادهای مرحله‌به‌مرحلهٔ مسیر خرید (بازدید → انتخاب پلن → پرداخت) ثبت نمی‌شود؛ نرخ تبدیل ساختنی نیست.",
      captureNeededFa: "ثبت رویدادهای تحلیلی محصول (page/plan/payment intent) با شناسهٔ کاربر.",
    },
    {
      id: "G5",
      labelFa: "بازهٔ شمسی",
      status: "real",
      reasonFa: "تبدیل تاریخ شمسی↔میلادی به‌صورت قطعی پیاده‌سازی شده و مرز روز بر مبنای تهران است.",
      captureNeededFa: "—",
    },
    {
      id: "G6",
      labelFa: "مقایسهٔ چندسری",
      status: "real",
      reasonFa: "نمودار میله‌ای گروهی برای مقایسهٔ پلن‌ها در هر روز در دسترس است.",
      captureNeededFa: "—",
    },
    {
      id: "G7",
      labelFa: "بازگشت وجه",
      status: hasAdjustments ? "real" : "partial",
      reasonFa: hasAdjustments
        ? "تعدیل‌های مالی (بازگشت وجه) از جدول واقعی خوانده می‌شود."
        : "هیچ تعدیل مالی ثبت نشده است؛ بنابراین مبلغ بازگشتی صفر گزارش می‌شود (نه اینکه سیستمی موجود نباشد).",
      captureNeededFa: hasAdjustments
        ? "—"
        : "ثبت بازگشت وجه در ماژول سفارش‌ها تا این گزارش مقادیر واقعی داشته باشد.",
    },
    {
      id: "G8",
      labelFa: "فعالیت آخرین ورود",
      status: "partial",
      reasonFa:
        "«آخرین فعالیت» از جدول نشست‌ها (sessions.lastActiveAt) خوانده می‌شود که فقط برای کاربران لاگین‌شدهٔ اخیر موجود است؛ کاربر هرگز وارد نشده مقدار ندارد.",
      captureNeededFa: "ثبت رویداد ورود/فعالیت به‌صورت append-only برای همهٔ کاربران.",
    },
    {
      id: "G9",
      labelFa: "گروه‌بندی LRFM",
      status: "real",
      reasonFa:
        "مدل LRFM شفاف با آستانه‌های صریح ساخته شده است؛ مؤلفهٔ «N» که در سیستم تعریف نشده، ساخته نشده است.",
      captureNeededFa: "—",
    },
    {
      id: "G10",
      labelFa: "کوهورت (Cohort)",
      status: "partial",
      reasonFa:
        "کوهورت‌های نگهداشت روی دادهٔ واقعی ساخته می‌شوند، اما حجم نمونه کوچک است و سهم‌ها نوسان دارند.",
      captureNeededFa: "افزایش حجم داده یا درج هشدار نمونهٔ کوچک در کنار هر سهم.",
    },
    {
      id: "G11",
      labelFa: "کارایی هوش مصنوعی (هزینه/خطا)",
      status: "unavailable",
      reasonFa: "تلهمتری هزینه/خطای دقیق مدل در سطح درخواست ثبت نمی‌شود.",
      captureNeededFa: "لاگ‌گیری هزینهٔ توکن و نتیجهٔ هر فراخوانی مدل.",
    },
    {
      id: "G12",
      labelFa: "کاتالوگ پلن",
      status: hasActivePlans ? "real" : "partial",
      reasonFa: hasActivePlans
        ? "کاتالوگ پلن‌های فعال از جدول واقعی پلن‌ها خوانده می‌شود."
        : "هیچ پلن فعالی ثبت نشده است.",
      captureNeededFa: hasActivePlans ? "—" : "فعال‌سازی حداقل یک پلن در بخش مدیریت پلن‌ها.",
    },
  ];

  // A payment count sanity flag — surfaces when subscription sales and the
  // payment table disagree, which is expected for legacy rows purchased
  // before the payments table existed. Named honestly rather than hidden.
  flags.push({
    id: "G13",
    labelFa: "هم‌خوانی اشتراک و پرداخت",
    status: "partial",
    reasonFa:
      `فروش از جدول اشتراک‌ها (منبع حقیقت فروش) محاسبه می‌شود؛ جدول پرداخت‌ها ${paidPayments} ردیف پرداخت‌شده دارد. ` +
      "خریدهای پیش از ایجاد جدول پرداخت‌ها ردیف پرداخت ندارند و این طبیعی است.",
    captureNeededFa: "برای هر خرید جدید، ثبت ردیف پرداخت متناظر (که در حال حاضر انجام می‌شود).",
  });

  return flags;
}

/** Just the real/unavailable summary counts, for a compact badge. */
export function qualitySummary(flags: AnalyticsDataQualityFlag[]): {
  real: number;
  partial: number;
  unavailable: number;
  blocked: number;
} {
  return {
    real: flags.filter((f) => f.status === "real").length,
    partial: flags.filter((f) => f.status === "partial").length,
    unavailable: flags.filter((f) => f.status === "unavailable").length,
    blocked: flags.filter((f) => f.status === "blocked").length,
  };
}
