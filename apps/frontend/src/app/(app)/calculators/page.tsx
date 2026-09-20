// ============================================================
// LEGALIR — Calculators catalog (محاسبه‌گرها)
// ============================================================
// Lists every registered calculator, grouped by category. Metadata
// comes from the calculator registry itself, so adding a calculator
// requires no change here.

"use client";

import Link from "next/link";
import {
  listCalculators,
  CALCULATOR_CATEGORY_FA,
  CALCULATOR_CONFIDENCE_FA,
} from "@/lib/calculators";
import type { CalculatorCategory } from "@legalir/types";

const CATEGORY_ORDER: CalculatorCategory[] = [
  "judicial",
  "employment",
  "family",
  "civil",
];

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-success-50 text-success-700 border-success-200",
  medium: "bg-warning-50 text-warning-700 border-warning-200",
  low: "bg-error-50 text-error-700 border-error-200",
};

export default function CalculatorsPage() {
  const calculators = listCalculators();

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: calculators.filter((c) => c.def.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-h2 text-on-surface font-bold">محاسبه‌گرهای حقوقی</h1>
        <p className="text-body-2 text-on-surface-variant mt-1">
          محاسبات دقیق و مستند بر پایه قوانین و تعرفه‌های رسمی — بدون واسپاری به هوش مصنوعی.
        </p>
      </header>

      {grouped.map((group) => (
        <section
          key={group.category}
          className="mb-8"
          aria-label={CALCULATOR_CATEGORY_FA[group.category]}
        >
          <h2 className="text-h3 text-on-surface font-bold mb-3">
            {CALCULATOR_CATEGORY_FA[group.category]}
          </h2>
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
            {group.items.map(({ def }) => (
              <Link
                key={def.slug}
                href={`/calculators/${def.slug}`}
                className="group rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5 shadow-elevation-1 hover:shadow-elevation-4 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] transition-all duration-short4 ease-standard active:scale-[0.98] flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`h-11 w-11 rounded-medium bg-gradient-to-br ${def.gradient} flex items-center justify-center text-xl shadow-elevation-1 group-hover:scale-110 transition-transform duration-short4 ease-standard`}
                    aria-hidden="true"
                  >
                    {def.icon}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_TONE[def.confidence]}`}
                  >
                    {CALCULATOR_CONFIDENCE_FA[def.confidence]}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="text-body-1 text-on-surface font-semibold group-hover:text-primary transition-colors">
                    {def.titleFa}
                  </h3>
                  <p className="text-caption text-on-surface-variant mt-1 leading-relaxed">
                    {def.subtitleFa}
                  </p>
                </div>

                <p className="text-[10px] text-[color-mix(in_srgb,var(--color-on-surface-variant)_70%,transparent)] border-t border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] pt-2">
                  {def.legalBasisFa}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="text-caption text-on-surface-variant text-center mt-8">
        نتایج این محاسبه‌گرها جنبه اطلاع‌رسانی دارد و جایگزین نظر کارشناس حقوقی نیست.
      </p>
    </div>
  );
}
