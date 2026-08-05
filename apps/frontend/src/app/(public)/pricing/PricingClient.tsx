"use client";

import Link from "next/link";
import { usePlansV1 } from "@/hooks/useSubscription";
import { SkeletonCard, ErrorState, EmptyState } from "@legalir/ui";
import { toPersianNumber, toPersianCurrency } from "@/lib/persian-utils";
import { IconCheck, IconClose } from "@/lib/icons";
import type { Plan } from "@legalir/types";
import { useState } from "react";

// ============================================================
// Feature keys for the comparison table
// ============================================================
const COMPARISON_FEATURES = [
  { key: "dailyRequests", label: "درخواست روزانه" },
  { key: "totalTokens", label: "مجموع توکن ماهانه" },
  { key: "AI_CHAT_MESSAGE", label: "پیام هوش مصنوعی" },
  { key: "DOCUMENT_ANALYSIS", label: "تحلیل سند" },
  { key: "CONTRACT_GENERATION", label: "ایجاد قرارداد" },
  { key: "ADVANCED_REFERENCE", label: "منابع پیشرفته" },
  { key: "PRIORITY_PROCESSING", label: "اولویت پردازش" },
  { key: "support", label: "پشتیبانی" },
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
  if (plan.code === "ultra") return "پیامکی";
  if (plan.code === "pro") return "تلفنی";
  return "اختصاصی";
}

// ============================================================
// PlanCard
// ============================================================

function PlanCard({ plan, isHighlighted }: { plan: Plan; isHighlighted?: boolean }) {
  return (
    <div
      className={[
        "rounded-large p-6 flex flex-col border transition-shadow",
        isHighlighted
          ? "bg-primary/[0.04] border-primary shadow-elevation-4 ring-1 ring-primary/20"
          : "bg-surface border-divider shadow-elevation-1 hover:shadow-elevation-4",
      ].join(" ")}
    >
      {/* Plan name */}
      <h3 className="text-h3 text-on-surface mb-1">{plan.nameFa}</h3>
      <p className="text-body-2 text-muted mb-4 min-h-[2.5rem]">{plan.descriptionFa}</p>

      {/* Pricing */}
      <div className="mb-6">
        {/* Original price (crossed out) */}
        <div className="flex items-baseline gap-1">
          <span className="text-body-2 text-muted line-through">
            {toPersianCurrency(plan.listPrice)}
          </span>
          {plan.listPrice > plan.salePrice && (
            <span className="text-caption text-error bg-error/10 rounded-small px-2 py-0.5">
              {Math.round((1 - plan.salePrice / plan.listPrice) * 100)}٪ تخفیف
            </span>
          )}
        </div>
        {/* Sale price */}
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-h1 text-secondary font-bold">
            {toPersianNumber(plan.salePrice)}
          </span>
          <span className="text-body-2 text-muted">تومان</span>
        </div>
        <p className="text-caption text-muted mt-1">{plan.durationDays} روز</p>
      </div>

      {/* Features list */}
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="text-body-2 text-on-surface flex items-start gap-2">
            <IconCheck size={16} className="text-success mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={`/auth/mobile?intent=subscribe&plan=${plan.code}`}
        className="block rounded-medium bg-primary text-white px-6 py-3 text-button text-center hover:bg-primary-variant transition-colors touch-target w-full"
      >
        انتخاب {plan.nameFa}
      </Link>
    </div>
  );
}

// ============================================================
// FeatureComparisonTable — Mobile-friendly comparison
// ============================================================

function FeatureComparisonTable({ plans }: { plans: Plan[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleFeatures = showAll
    ? COMPARISON_FEATURES
    : COMPARISON_FEATURES.slice(0, 5);

  return (
    <div className="mt-16">
      <h2 className="text-h2 text-on-surface text-center mb-6">مقایسه ویژگی‌ها</h2>

      {/* Mobile: Card-based comparison */}
      <div className="tablet:hidden space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-large bg-surface border border-divider p-4">
            <h3 className="text-h3 text-on-surface mb-3 text-center">{plan.nameFa}</h3>
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
                  <div key={f.key} className="flex justify-between items-center py-2 border-b border-divider/50 last:border-0">
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
        ))}
      </div>

      {/* Tablet/Desktop: Matrix table */}
      <div className="hidden tablet:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-divider">
              <th className="text-right py-3 px-4 text-body-2 text-muted font-normal min-w-[180px]">
                ویژگی
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="text-center py-3 px-4 text-h3 text-on-surface">
                  {plan.nameFa}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFeatures.map((f, idx) => (
              <tr
                key={f.key}
                className={[
                  "border-b border-divider/50",
                  idx % 2 === 0 ? "bg-surface" : "bg-background",
                ].join(" ")}
              >
                <td className="py-3 px-4 text-body-2 text-on-surface">{f.label}</td>
                {plans.map((plan) => {
                  if (f.key === "support") {
                    return (
                      <td key={plan.id} className="text-center py-3 px-4 text-body-2 text-on-surface">
                        {getSupportLabel(plan)}
                      </td>
                    );
                  }

                  if (f.key === "dailyRequests" || f.key === "totalTokens") {
                    return (
                      <td key={plan.id} className="text-center py-3 px-4 text-body-2 text-on-surface">
                        {getFeatureLimit(plan, f.key)}
                      </td>
                    );
                  }

                  const ul = plan.usageLimits.find((l) => l.featureKey === f.key);
                  return (
                    <td key={plan.id} className="text-center py-3 px-4">
                      {ul ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <IconCheck size={16} className="text-success" />
                          <span className="text-body-2 text-on-surface">
                            {toPersianNumber(ul.limit)}
                          </span>
                        </div>
                      ) : (
                        <IconClose size={16} className="text-error mx-auto" />
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
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-button text-primary hover:text-primary-variant transition-colors"
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
      className="grid tablet:grid-cols-3 gap-6 max-w-4xl mx-auto"
      aria-busy="true"
      aria-label="در حال بارگذاری تعرفه‌ها"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider"
        >
          <SkeletonCard lines={4} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PricingClient
// ============================================================

export function PricingClient() {
  const {
    data: plans,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlansV1();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-h1 text-on-surface mb-3">تعرفه‌های LEGALIR</h1>
        <p className="text-body-1 text-muted max-w-xl mx-auto">
          پلن مناسب خود را انتخاب کنید. همه پلن‌ها شامل دسترسی آزمایشی اولیه هستند
        </p>
      </div>

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
          action={{
            label: "تلاش مجدد",
            onClick: () => refetch(),
          }}
        />
      )}

      {/* Plans Grid */}
      {!isLoading && !isError && plans && plans.length > 0 && (
        <>
          <div className="grid tablet:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isHighlighted={plan.code === "pro"}
              />
            ))}
          </div>

          {/* Feature Comparison Table */}
          <FeatureComparisonTable plans={plans} />

          {/* Footnote */}
          <p className="text-center text-caption text-muted mt-8">
            تمام قیمت‌ها به تومان و با احتساب مالیات است. امکان ارتقا یا تمدید در هر زمان وجود دارد
          </p>
        </>
      )}
    </div>
  );
}
