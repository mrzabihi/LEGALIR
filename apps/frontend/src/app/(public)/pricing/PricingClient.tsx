"use client";

import Link from "next/link";
import { usePlansV1 } from "@/hooks/useSubscription";
import { SkeletonCard, ErrorState, EmptyState } from "@legalir/ui";
import { toPersianNumber, toPersianCurrency } from "@/lib/persian-utils";
import { IconCheck, IconClose, IconShield, IconArrowBack } from "@/lib/icons";
import type { Plan } from "@legalir/types";
import { useState } from "react";

// ============================================================
// Plan configuration for display
// ============================================================

const PLAN_META = {
  ultra: {
    gradientFrom: "from-primary-800",
    gradientTo: "to-primary-900",
    borderColor: "border-primary-300",
    badge: null,
    popular: false,
  },
  pro: {
    gradientFrom: "from-secondary-600",
    gradientTo: "to-secondary-800",
    borderColor: "border-secondary-400",
    badge: "توصیه شده",
    popular: true,
  },
  pro_max: {
    gradientFrom: "from-primary-700",
    gradientTo: "to-primary-900",
    borderColor: "border-primary-400",
    badge: "حرفه‌ای",
    popular: false,
  },
} as const;

function getPlanMeta(code: string): typeof PLAN_META[keyof typeof PLAN_META] {
  const key = code as keyof typeof PLAN_META;
  return PLAN_META[key] ?? PLAN_META.ultra;
}

// ============================================================
// Feature keys for the comparison table
// ============================================================
const COMPARISON_FEATURES = [
  { key: "dailyRequests", label: "درخواست روزانه", icon: "bolt" },
  { key: "totalTokens", label: "مجموع توکن ماهانه", icon: "token" },
  { key: "AI_CHAT_MESSAGE", label: "پیام هوش مصنوعی", icon: "chat" },
  { key: "DOCUMENT_ANALYSIS", label: "تحلیل سند", icon: "document" },
  { key: "CONTRACT_GENERATION", label: "ایجاد قرارداد", icon: "contract" },
  { key: "ADVANCED_REFERENCE", label: "منابع پیشرفته", icon: "reference" },
  { key: "PRIORITY_PROCESSING", label: "اولویت پردازش", icon: "priority" },
  { key: "support", label: "پشتیبانی", icon: "support" },
] as const;

// ============================================================
// Helpers
// ============================================================

function getFeatureLimit(plan: Plan, key: string): string {
  switch (key) {
    case "dailyRequests":
      return `${toPersianNumber(plan.dailyRequestLimit)} درخواست`;
    case "totalTokens":
      return toPersianNumber(plan.totalTokenLimit);
    default: {
      const limit = plan.usageLimits.find((l) => l.featureKey === key);
      if (!limit) return "—";
      return toPersianNumber(limit.limit);
    }
  }
}

function getSupportLabel(plan: Plan): string {
  if (plan.code === "pro_max") return "اختصاصی ۲۴/۷";
  if (plan.code === "pro") return "تلفنی";
  return "پیامکی";
}

// ============================================================
// PlanCard — Stunning premium design
// ============================================================

function PlanCard({
  plan,
  isYearly,
}: {
  plan: Plan;
  isYearly: boolean;
}) {
  const meta = getPlanMeta(plan.code);
  const discountPercent = plan.listPrice > plan.salePrice
    ? Math.round((1 - plan.salePrice / plan.listPrice) * 100)
    : 0;

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl bg-surface border-2 transition-all duration-medium1",
        "card-lift",
        meta.popular
          ? "border-secondary-400 shadow-elevation-8 scale-[1.02] tablet:scale-105 z-10"
          : `${meta.borderColor} shadow-elevation-4 hover:shadow-elevation-8`,
      ].join(" ")}
    >
      {/* Recommended Badge */}
      {meta.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
          <span
            className={[
              "rounded-full px-5 py-1 text-caption font-bold whitespace-nowrap shadow-elevation-4",
              meta.popular
                ? "bg-secondary-600 text-white"
                : "bg-primary-700 text-primary-50",
            ].join(" ")}
          >
            {meta.badge}
          </span>
        </div>
      )}

      {/* Card Header — Gradient */}
      <div
        className={[
          "rounded-t-2xl px-6 pt-8 pb-6 text-center",
          "bg-gradient-to-b",
          meta.gradientFrom,
          meta.gradientTo,
          meta.popular ? "pt-10" : "",
        ].join(" ")}
      >
        <h3 className="text-h3 text-white mb-1.5">{plan.nameFa}</h3>
        <p className="text-body-2 text-primary-100/80 min-h-[3rem] leading-relaxed">
          {plan.descriptionFa}
        </p>
      </div>

      {/* Card Body */}
      <div className="flex flex-col flex-1 px-6 pb-6 pt-5">
        {/* Pricing */}
        <div className="text-center mb-5">
          {/* Original price */}
          {discountPercent > 0 && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-body-2 text-muted line-through">
                {toPersianCurrency(plan.listPrice)}
              </span>
              <span className="rounded-full bg-error/10 text-error text-caption px-2 py-0.5 font-bold">
                {toPersianNumber(discountPercent)}٪ تخفیف
              </span>
            </div>
          )}
          {/* Sale price */}
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={[
                "font-bold leading-none",
                meta.popular ? "text-h1 text-secondary" : "text-h1 text-primary-800",
              ].join(" ")}
            >
              {toPersianNumber(plan.salePrice)}
            </span>
            <span className="text-body-2 text-muted">تومان</span>
          </div>
          <p className="text-caption text-muted mt-1.5">
            {plan.durationDays} روز
            {isYearly && (
              <span className="text-success mr-1">
                ({toPersianNumber(plan.salePrice * 2)} تخفیف سالانه)
              </span>
            )}
          </p>
        </div>

        {/* Feature highlights */}
        <div className="rounded-xl bg-neutral-50 p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted">درخواست روزانه</span>
            <span className="text-on-surface font-medium">
              {toPersianNumber(plan.dailyRequestLimit)}
            </span>
          </div>
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted">توکن ماهانه</span>
            <span className="text-on-surface font-medium">
              {toPersianNumber(plan.totalTokenLimit)}
            </span>
          </div>
          {plan.usageLimits.slice(0, 3).map((ul) => (
            <div key={ul.featureKey} className="flex items-center justify-between text-caption">
              <span className="text-muted">{ul.nameFa}</span>
              <span className="text-on-surface font-medium">
                {toPersianNumber(ul.limit)}
              </span>
            </div>
          ))}
        </div>

        {/* Features list */}
        <ul className="space-y-3 mb-6 flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span
                className={[
                  "rounded-full p-0.5 mt-0.5 shrink-0",
                  meta.popular ? "text-secondary" : "text-primary-600",
                ].join(" ")}
              >
                <IconCheck size={16} />
              </span>
              <span className="text-body-2 text-on-surface leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href={meta.popular
            ? `/login?intent=subscribe&plan=${plan.code}`
            : `/login?intent=subscribe&plan=${plan.code}`}
          className={[
            "block rounded-large px-6 py-3.5 text-button text-center font-bold transition-all duration-short3",
            "touch-target-min w-full",
            meta.popular
              ? "bg-secondary-600 text-white hover:bg-secondary-700 shadow-elevation-3 hover:shadow-elevation-8 animate-glow"
              : "bg-primary-700 text-white hover:bg-primary-800 shadow-elevation-2 hover:shadow-elevation-4",
          ].join(" ")}
        >
          شروع با {plan.nameFa}
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// FeatureComparisonTable — Enhanced table
// ============================================================

function FeatureComparisonTable({ plans }: { plans: Plan[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleFeatures = showAll
    ? COMPARISON_FEATURES
    : COMPARISON_FEATURES.slice(0, 5);

  return (
    <div className="mt-20">
      <div className="text-center mb-10">
        <h2 className="text-h2 text-primary-800 mb-2">مقایسه کامل ویژگی‌ها</h2>
        <p className="text-body-2 text-muted max-w-xl mx-auto leading-relaxed">
          مقایسه دقیق قابلیت‌ها و محدودیت‌های هر پلن تا بهترین انتخاب را داشته باشید
        </p>
      </div>

      {/* Mobile: Card-based comparison */}
      <div className="tablet:hidden space-y-4">
        {plans.map((plan) => {
          const meta = getPlanMeta(plan.code);
          return (
            <div
              key={plan.id}
              className={[
                "rounded-xl bg-surface border-2 shadow-sm p-5",
                meta.popular ? "border-secondary-300" : "border-neutral-200",
              ].join(" ")}
            >
              <div
                className={[
                  "text-center py-2 rounded-lg mb-4 text-white font-bold",
                  "bg-gradient-to-r",
                  meta.gradientFrom,
                  meta.gradientTo,
                ].join(" ")}
              >
                <h3 className="text-h3">{plan.nameFa}</h3>
                {meta.badge && (
                  <span className="text-caption opacity-80">{meta.badge}</span>
                )}
              </div>
              <div className="space-y-3">
                {COMPARISON_FEATURES.map((f) => {
                  const value =
                    f.key === "support"
                      ? getSupportLabel(plan)
                      : f.key === "dailyRequests" || f.key === "totalTokens"
                        ? getFeatureLimit(plan, f.key)
                        : (() => {
                            const ul = plan.usageLimits.find((l) => l.featureKey === f.key);
                            if (!ul) return null;
                            return `${toPersianNumber(ul.limit)} عدد`;
                          })();

                  return (
                    <div
                      key={f.key}
                      className="flex justify-between items-center py-3 border-b border-neutral-100 last:border-0"
                    >
                      <span className="text-body-2 text-muted">{f.label}</span>
                      <span className="text-body-2 text-on-surface font-medium">
                        {value === null ? (
                          <IconClose size={16} className="text-error inline" />
                        ) : (
                          value
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tablet/Desktop: Styled matrix table */}
      <div className="hidden tablet:block overflow-x-auto rounded-2xl border border-neutral-200 shadow-elevation-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-primary-800 to-primary-900">
              <th className="text-right py-5 px-6 text-body-2 text-primary-100 font-medium min-w-[200px] rounded-tr-2xl">
                ویژگی
              </th>
              {plans.map((plan, idx) => {
                const _meta = getPlanMeta(plan.code);
                const isLast = idx === plans.length - 1;
                return (
                  <th
                    key={plan.id}
                    className={[
                      "text-center py-5 px-5 text-white",
                      isLast ? "rounded-tl-2xl" : "",
                    ].join(" ")}
                  >
                    <div className="text-h3 font-bold mb-0.5">{plan.nameFa}</div>
                    <div className="text-caption text-primary-100/70">
                      {toPersianCurrency(plan.salePrice)} / {plan.durationDays} روز
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleFeatures.map((f, idx) => (
              <tr
                key={f.key}
                className={[
                  "border-b border-neutral-100 last:border-0 transition-colors",
                  idx % 2 === 0 ? "bg-white hover:bg-neutral-50" : "bg-neutral-50/50 hover:bg-neutral-100/50",
                ].join(" ")}
              >
                <td className="py-4 px-6 text-body-2 text-on-surface font-medium">
                  {f.label}
                </td>
                {plans.map((plan) => {
                  if (f.key === "support") {
                    return (
                      <td
                        key={plan.id}
                        className="text-center py-4 px-5 text-body-2 text-on-surface"
                      >
                        {getSupportLabel(plan)}
                      </td>
                    );
                  }

                  if (f.key === "dailyRequests" || f.key === "totalTokens") {
                    return (
                      <td
                        key={plan.id}
                        className="text-center py-4 px-5 text-body-2 text-on-surface"
                      >
                        {getFeatureLimit(plan, f.key)}
                      </td>
                    );
                  }

                  const ul = plan.usageLimits.find((l) => l.featureKey === f.key);
                  return (
                    <td key={plan.id} className="text-center py-4 px-5">
                      {ul ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <IconCheck size={18} className="text-success" />
                          <span className="text-body-2 text-on-surface font-medium">
                            {toPersianNumber(ul.limit)}
                          </span>
                        </div>
                      ) : (
                        <IconClose size={18} className="text-error mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more / less toggle */}
      {COMPARISON_FEATURES.length > 5 && (
        <div className="text-center mt-8">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-neutral-300 text-button text-primary-700 hover:bg-primary-50 hover:border-primary-300 transition-all"
          >
            {showAll ? "نمایش کمتر" : "نمایش همه ویژگی‌ها"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Skeleton / Empty / Error states
// ============================================================

function PricingSkeletons() {
  return (
    <div
      className="grid tablet:grid-cols-3 gap-6 max-w-5xl mx-auto -mt-20 relative z-10"
      aria-busy="true"
      aria-label="در حال بارگذاری تعرفه‌ها"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface p-6 shadow-elevation-2 border border-neutral-200"
        >
          <SkeletonCard lines={5} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Trust / Security Bar
// ============================================================

function TrustBar() {
  return (
    <section className="bg-gradient-to-r from-primary-800 via-primary-900 to-primary-800 text-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <IconShield size={28} className="text-secondary-300" />
            </div>
            <div>
              <h3 className="text-body-1 font-bold text-white mb-1">پرداخت امن</h3>
              <p className="text-caption text-primary-100/70">
                تمام تراکنش‌ها از درگاه‌های امن بانکی انجام می‌شود
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <IconArrowBack size={28} className="text-secondary-300 rtl-flip rotate-180" />
            </div>
            <div>
              <h3 className="text-body-1 font-bold text-white mb-1">بازگشت وجه</h3>
              <p className="text-caption text-primary-100/70">
                ضمانت بازگشت وجه تا ۷ روز پس از خرید
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-secondary-300">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-body-1 font-bold text-white mb-1">پشتیبانی ۲۴/۷</h3>
              <p className="text-caption text-primary-100/70">
                تیم پشتیبانی ما همیشه آماده پاسخگویی به شماست
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ Section
// ============================================================

function FaqSection() {
  const faqs = [
    {
      q: "چگونه می‌توانم پلن خود را ارتقا دهم؟",
      a: "شما می‌توانید در هر زمان از طریق صفحه اشتراک، پلن خود را ارتقا دهید. مبلغ پرداختی پلن قبلی به صورت пропорشنال در پلن جدید محاسبه می‌شود.",
    },
    {
      q: "آیا امکان بازگشت وجه وجود دارد؟",
      a: "بله، شما تا ۷ روز پس از خرید می‌توانید درخواست بازگشت وجه دهید. مبلغ به حساب بانکی شما عودت داده خواهد شد.",
    },
    {
      q: "آیا پلن رایگان محدودیت دارد؟",
      a: "پلن رایگان شامل ۵ درخواست روزانه و دسترسی پایه به تمام خدمات LEGALIR است. برای استفاده حرفه‌ای، پلن‌های پرو و الترا پیشنهاد می‌شود.",
    },
  ];

  return (
    <section className="py-16 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-h2 text-primary-800 text-center mb-2">سوالات متداول</h2>
        <p className="text-body-2 text-muted text-center mb-10">
          پاسخ به پرتکرارترین سوالات درباره اشتراک LEGALIR
        </p>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <details
              key={idx}
              className="group rounded-xl bg-surface border border-neutral-200 shadow-sm transition-shadow hover:shadow-elevation-2"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                <span className="text-body-1 text-on-surface font-medium">{faq.q}</span>
                <span className="text-muted group-open:rotate-180 transition-transform duration-short3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-5 text-body-2 text-muted leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PricingClient — Main Page
// ============================================================

export function PricingClient() {
  const {
    data: plans,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlansV1();

  const [isYearly, setIsYearly] = useState(false);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-800 via-primary-900 to-primary-900 text-white py-20 tablet:py-28">
        {/* Decorative background patterns */}
        <div className="absolute inset-0 bg-geometric-pattern pointer-events-none" />
        <div className="absolute inset-0 bg-noise pointer-events-none" />

        {/* Decorative floating rings */}
        <div className="absolute top-10 right-[-5%] w-72 h-72 rounded-full border border-primary-600/20 opacity-30" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full border border-secondary-600/10 opacity-20" />

        <div className="relative mx-auto max-w-6xl px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-caption mb-6">
            <div className="w-2 h-2 rounded-full bg-secondary-400 animate-pulse" />
            تخفیف ویژه تابستان — تا ۶۰٪ تخفیف
          </div>

          <h1 className="text-h1 tablet:text-[40px] tablet:leading-[56px] text-white mb-4 font-bold tracking-tight">
            تعرفه‌های{" "}
            <span className="text-secondary-400 relative">
              LEGALIR
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-secondary-500/30 rounded-full" />
            </span>
          </h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed mb-8">
            پلن مناسب خود را انتخاب کنید. شروع با نسخه رایگان و ارتقا در هر زمان
          </p>

          {/* Monthly/Yearly Toggle */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={[
                "rounded-full px-5 py-2 text-button font-medium transition-all",
                !isYearly
                  ? "bg-white text-primary-800 shadow-elevation-1"
                  : "text-white/70 hover:text-white",
              ].join(" ")}
            >
              ماهانه
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={[
                "rounded-full px-5 py-2 text-button font-medium transition-all",
                isYearly
                  ? "bg-white text-primary-800 shadow-elevation-1"
                  : "text-white/70 hover:text-white",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5">
                سالانه
                <span className="rounded-full bg-success text-white text-[10px] px-1.5 py-0.5 font-bold">
                  ۲۰٪ تخفیف
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="bg-white py-16 relative">
        <div className="mx-auto max-w-6xl px-4">
          {/* Loading */}
          {isLoading && <PricingSkeletons />}

          {/* Error */}
          {isError && !isLoading && (
            <ErrorState
              title="خطا در دریافت تعرفه‌ها"
              message={
                error instanceof Error
                  ? error.message
                  : "لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید"
              }
              onRetry={() => refetch()}
              fullPage
            />
          )}

          {/* Empty */}
          {!isLoading && !isError && plans && plans.length === 0 && (
            <EmptyState
              title="هیچ پلنی یافت نشد"
              description="در حال حاضر تعرفه‌ای برای نمایش وجود ندارد. لطفاً بعداً بررسی کنید"
            />
          )}

          {/* Plans Grid */}
          {!isLoading && !isError && plans && plans.length > 0 && (
            <>
              <div className="grid tablet:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isYearly={isYearly}
                  />
                ))}
              </div>

              {/* Feature Comparison Table */}
              <FeatureComparisonTable plans={plans} />
            </>
          )}
        </div>
      </section>

      {/* Trust / Security Bar */}
      <TrustBar />

      {/* FAQ Section */}
      {!isLoading && !isError && plans && plans.length > 0 && <FaqSection />}

      {/* Footnote */}
      {!isLoading && !isError && plans && plans.length > 0 && (
        <section className="bg-white border-t border-neutral-200 py-8">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <p className="text-caption text-muted">
              تمام قیمت‌ها به تومان و با احتساب مالیات است. امکان ارتقا یا تمدید در هر زمان وجود دارد.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
