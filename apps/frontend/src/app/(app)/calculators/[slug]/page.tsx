// ============================================================
// LEGALIR — Calculator detail (محاسبه‌گر)
// ============================================================
// Renders a form from the calculator's own field definitions and runs
// the deterministic engine entirely client-side. No network, no LLM:
// the same input always yields the same output for a dataset version.
//
// The form is generated from `def.fields`, so a new calculator needs
// no change here.

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { TextField, Select, Checkbox } from "@legalir/ui";
import {
  getCalculator,
  runCalculator,
  CalculatorInputError,
  CALCULATOR_CATEGORY_FA,
  CALCULATOR_CONFIDENCE_FA,
  type CalculatorInput,
} from "@/lib/calculators";
import type {
  CalculationResult,
  CalculatorField,
} from "@legalir/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-success-50 text-success-700 border-success-200",
  medium: "bg-warning-50 text-warning-700 border-warning-200",
  low: "bg-error-50 text-error-700 border-error-200",
};

/** Seed the form state from each field's declared default. */
function initialInput(fields: CalculatorField[]): CalculatorInput {
  const out: CalculatorInput = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
  }
  return out;
}

export default function CalculatorDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const calc = getCalculator(slug);

  if (!calc) return <NotFoundState slug={slug} />;

  return <CalculatorWorkspace key={slug} slug={slug} />;
}

// ============================================================
// Workspace — form + live result
// ============================================================

function CalculatorWorkspace({ slug }: { slug: string }) {
  const calc = getCalculator(slug)!;
  const { def } = calc;

  const [input, setInput] = useState<CalculatorInput>(() =>
    initialInput(def.fields)
  );
  const [error, setError] = useState<string | null>(null);

  // Recompute on every keystroke. The engine is pure and cheap, so a
  // memo over the input object is all the caching we need.
  const result = useMemo<CalculationResult | null>(() => {
    try {
      const r = runCalculator(slug, input);
      setError(null);
      return r;
    } catch (e) {
      if (e instanceof CalculatorInputError) {
        setError(e.message);
        return null;
      }
      setError("خطا در محاسبه");
      return null;
    }
  }, [slug, input]);

  const setField = (key: string, value: number | string | boolean) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 tablet:p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-caption text-on-surface-variant" aria-label="مسیر">
        <Link href="/calculators" className="hover:text-primary transition-colors">
          محاسبه‌گرها
        </Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span className="text-on-surface">{def.titleFa}</span>
      </nav>

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start gap-4">
          <span
            className={`h-14 w-14 shrink-0 rounded-large bg-gradient-to-br ${def.gradient} flex items-center justify-center text-2xl shadow-elevation-1`}
            aria-hidden="true"
          >
            {def.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-h2 text-on-surface font-bold">{def.titleFa}</h1>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_TONE[def.confidence]}`}
              >
                {CALCULATOR_CONFIDENCE_FA[def.confidence]}
              </span>
            </div>
            <p className="text-body-2 text-on-surface-variant mt-1">
              {def.descriptionFa}
            </p>
            <p className="text-caption text-on-surface-variant mt-2 flex items-center gap-1.5">
              <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-primary px-2 py-0.5">
                {CALCULATOR_CATEGORY_FA[def.category]}
              </span>
              <span className="text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_70%,transparent)]">
                {def.legalBasisFa}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-6 items-start">
        {/* ---- Input form ---- */}
        <section
          className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5 shadow-elevation-1"
          aria-label="ورودی‌های محاسبه"
        >
          <h2 className="text-h3 text-on-surface font-bold mb-4">اطلاعات ورودی</h2>
          <div className="space-y-4">
            {def.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={input[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            ))}
          </div>
        </section>

        {/* ---- Result ---- */}
        <section
          className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5 shadow-elevation-1 desktop:sticky desktop:top-6"
          aria-label="نتیجه محاسبه"
          aria-live="polite"
        >
          <h2 className="text-h3 text-on-surface font-bold mb-4">نتیجه</h2>

          {error ? (
            <div className="rounded-medium bg-error-50 border border-error-200 p-4 text-body-2 text-error-700">
              {error}
            </div>
          ) : result ? (
            <ResultView result={result} />
          ) : null}
        </section>
      </div>

      <p className="text-caption text-on-surface-variant text-center mt-8">
        نتایج این محاسبه‌گر جنبه اطلاع‌رسانی دارد و جایگزین نظر کارشناس حقوقی نیست.
      </p>
    </div>
  );
}

// ============================================================
// Field control — one input per declared field type
// ============================================================

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: CalculatorField;
  value: number | string | boolean | undefined;
  onChange: (v: number | string | boolean) => void;
}) {
  const id = `field-${field.key}`;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-2 text-on-surface">{field.labelFa}</span>
        <Checkbox
          id={id}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={field.labelFa}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Select
        id={id}
        label={field.labelFa}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        supportingText={field.helpFa}
        options={(field.options ?? []).map((o) => ({ value: o.value, label: o.labelFa }))}
      />
    );
  }

  // money | number | percent
  const suffix =
    field.type === "money"
      ? field.unit === "IRT"
        ? "تومان"
        : "ریال"
      : field.type === "percent"
        ? "٪"
        : undefined;

  return (
    <TextField
      id={id}
      type="text"
      inputMode="decimal"
      label={field.labelFa}
      required={field.required}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      min={field.min}
      max={field.max}
      step={field.step}
      suffix={suffix}
      fullWidth
      supportingText={field.helpFa}
    />
  );
}

// ============================================================
// Result view — headline, breakdown, warnings, provenance
// ============================================================

function ResultView({ result }: { result: CalculationResult }) {
  return (
    <div className="space-y-5">
      {/* Headline */}
      <div className="rounded-large bg-gradient-to-br from-primary-700 to-primary-900 text-white p-5 shadow-elevation-2">
        <p className="text-caption text-[color:color-mix(in_srgb,var(--color-white)_70%,transparent)] mb-1">
          مبلغ نهایی
        </p>
        <p className="text-h2 font-bold tabular-nums">{result.headlineFa}</p>
      </div>

      {/* Warnings */}
      {result.warningsFa.length > 0 && (
        <ul className="space-y-2" role="list">
          {result.warningsFa.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-medium bg-warning-50 border border-warning-200 p-3 text-caption text-warning-700"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Breakdown */}
      {result.steps.length > 0 && (
        <div>
          <h3 className="text-body-1 text-on-surface font-semibold mb-2">
            جزئیات محاسبه
          </h3>
          <ol className="space-y-2" role="list">
            {result.steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-body-2 text-on-surface">{step.labelFa}</p>
                  {step.noteFa && (
                    <p className="text-caption text-on-surface-variant mt-0.5">
                      {step.noteFa}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-body-2 text-on-surface font-medium tabular-nums">
                  {step.valueFa}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Provenance */}
      <div className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-4">
        <h3 className="text-caption text-on-surface-variant font-medium mb-2 flex items-center gap-1.5">
          <span aria-hidden="true">📖</span>
          منبع و اعتبار داده‌ها
        </h3>
        <dl className="space-y-1.5 text-caption">
          <ProvenanceRow label="سند" value={result.source.sourceTitle} />
          <ProvenanceRow label="مرجع" value={result.source.sourceAuthority} />
          <ProvenanceRow
            label="سال محاسبه"
            value={String(result.source.calculationYear)}
          />
          <ProvenanceRow label="نسخه" value={result.source.version} />
          <ProvenanceRow
            label="تاریخ بازبینی"
            value={result.source.verifiedAt}
          />
          {result.source.sourceUrl && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-on-surface-variant">پیوند:</dt>
              <dd className="min-w-0">
                <a
                  href={result.source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {result.source.sourceUrl}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {result.source.notes && (
          <p className="text-caption text-on-surface-variant mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] leading-relaxed">
            {result.source.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-on-surface-variant">{label}:</dt>
      <dd className="min-w-0 text-on-surface">{value}</dd>
    </div>
  );
}

// ============================================================
// Not found
// ============================================================

function NotFoundState({ slug }: { slug: string }) {
  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-8 shadow-elevation-1 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🔍</div>
        <h1 className="text-h3 text-on-surface font-bold mb-2">
          محاسبه‌گر یافت نشد
        </h1>
        <p className="text-body-2 text-on-surface-variant mb-5">
          محاسبه‌گری با شناسه «{slug}» وجود ندارد.
        </p>
        <Link
          href="/calculators"
          className="inline-flex items-center gap-1.5 rounded-medium bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          بازگشت به فهرست محاسبه‌گرها
        </Link>
      </div>
    </div>
  );
}
