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
import { TextField, Select, Checkbox, MoneyField } from "@legalir/ui";
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
  FieldVisibility,
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

/** True when a single visibility clause holds for the current input. */
function clauseHolds(
  clause: FieldVisibility,
  input: CalculatorInput
): boolean {
  const v = input[clause.key];
  if (clause.equals !== undefined && v !== clause.equals) return false;
  if (clause.in !== undefined && !clause.in.includes(v as never)) return false;
  if (clause.gt !== undefined && !(typeof v === "number" && v > clause.gt)) {
    return false;
  }
  if (clause.lt !== undefined && !(typeof v === "number" && v < clause.lt)) {
    return false;
  }
  return true;
}

/**
 * Progressive disclosure: a field is visible only while EVERY clause
 * holds (logical AND). Fields without `visibleWhen` are always shown.
 */
function isVisible(field: CalculatorField, input: CalculatorInput): boolean {
  if (!field.visibleWhen || field.visibleWhen.length === 0) return true;
  return field.visibleWhen.every((c) => clauseHolds(c, input));
}

/** Group fields by `groupFa`, preserving declaration order. */
function groupFields(
  fields: CalculatorField[]
): { groupFa?: string; fields: CalculatorField[] }[] {
  const groups: { groupFa?: string; fields: CalculatorField[] }[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (last && last.groupFa === f.groupFa) {
      last.fields.push(f);
    } else {
      groups.push({ groupFa: f.groupFa, fields: [f] });
    }
  }
  return groups;
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

  const setField = (key: string, value: number | string | boolean | undefined) => {
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
          <div className="space-y-6">
            {groupFields(def.fields).map((group, gi) => {
              const visible = group.fields.filter((f) => isVisible(f, input));
              if (visible.length === 0) return null;
              return (
                <fieldset key={group.groupFa ?? `g${gi}`} className="space-y-4">
                  {group.groupFa && (
                    <legend className="text-body-2 text-primary font-semibold mb-1">
                      {group.groupFa}
                    </legend>
                  )}
                  {visible.map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      value={input[field.key]}
                      parentValue={
                        field.optionFilter
                          ? input[field.optionFilter.parentKey]
                          : undefined
                      }
                      onChange={(v) => setField(field.key, v)}
                    />
                  ))}
                </fieldset>
              );
            })}
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
  parentValue,
  onChange,
}: {
  field: CalculatorField;
  value: number | string | boolean | undefined;
  /** Current value of the field's `optionFilter.parentKey`, if any. */
  parentValue?: number | string | boolean;
  onChange: (v: number | string | boolean | undefined) => void;
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
    // Cascading selects: when `optionFilter` is present, show only the
    // options the current parent value permits.
    const allowed = field.optionFilter
      ? field.optionFilter.allowed[String(parentValue ?? "")]
      : undefined;
    const options = (field.options ?? []).filter(
      (o) => !allowed || allowed.includes(o.value)
    );
    return (
      <Select
        id={id}
        label={field.labelFa}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        supportingText={field.helpFa}
        options={options.map((o) => ({ value: o.value, label: o.labelFa }))}
      />
    );
  }

  if (field.type === "text") {
    return (
      <TextField
        id={id}
        type="text"
        label={field.labelFa}
        required={field.required}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        supportingText={field.helpFa}
      />
    );
  }

  // Money gets the shared formatting field: live grouping, the unit
  // suffix and the «… تومان» words line, all driven by `field.unit`.
  if (field.type === "money") {
    return (
      <MoneyField
        id={id}
        label={field.labelFa}
        required={field.required}
        value={typeof value === "number" ? value : null}
        onChange={(v) => onChange(v ?? undefined)}
        unit={field.unit ?? "IRT"}
        min={field.min}
        max={field.max}
        fullWidth
        supportingText={field.helpFa}
      />
    );
  }

  // number | percent
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
      suffix={field.type === "percent" ? "٪" : undefined}
      fullWidth
      supportingText={field.helpFa}
    />
  );
}

// ============================================================
// Result view — headline, breakdown, warnings, provenance
// ============================================================

function ResultView({ result }: { result: CalculationResult }) {
  // A combination the engine will not guess at: show the honest message
  // instead of a number, and skip the headline entirely.
  if (result.unsupportedFa) {
    return (
      <div className="space-y-5">
        <div className="rounded-large bg-warning-50 border border-warning-200 p-5">
          <p className="text-body-1 text-warning-800 font-semibold mb-1 flex items-center gap-2">
            <span aria-hidden="true">🧭</span>
            نیازمند بررسی تخصصی
          </p>
          <p className="text-body-2 text-warning-700 leading-relaxed">
            {result.unsupportedFa}
          </p>
        </div>
        {result.explanationFa && (
          <ExplanationBlock text={result.explanationFa} />
        )}
        {result.legalNotesFa && result.legalNotesFa.length > 0 && (
          <LegalNotesBlock notes={result.legalNotesFa} />
        )}
        <ProvenanceBlock source={result.source} />
      </div>
    );
  }

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

      {/* Tables — one row per line item (e.g. per heir) */}
      {result.tables?.map((table, ti) => (
        <div key={ti}>
          <h3 className="text-body-1 text-on-surface font-semibold mb-2">
            {table.titleFa}
          </h3>
          <div className="overflow-x-auto rounded-medium border border-[color:var(--color-outline-variant)]">
            <table className="w-full text-caption border-collapse">
              <thead>
                <tr className="bg-surface-container-high">
                  {table.columnsFa.map((c, ci) => (
                    <th
                      key={ci}
                      scope="col"
                      className="px-3 py-2 text-on-surface-variant font-medium text-right whitespace-nowrap"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={
                      row.emphasis
                        ? "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
                        : "odd:bg-surface"
                    }
                  >
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-on-surface tabular-nums whitespace-nowrap border-t border-[color:var(--color-outline-variant)]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {table.footerFa && (
                <tfoot>
                  <tr className="bg-surface-container-high font-semibold">
                    {table.footerFa.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-on-surface tabular-nums whitespace-nowrap border-t border-[color:var(--color-outline-variant)]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ))}

      {/* Sections — grouped label/value rows (e.g. عرصه / اعیان) */}
      {result.sections?.map((section, si) => (
        <div key={si}>
          <h3 className="text-body-1 text-on-surface font-semibold mb-2">
            {section.titleFa}
          </h3>
          <dl className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] divide-y divide-[color:var(--color-outline-variant)]">
            {section.rows.map((row, ri) => (
              <div
                key={ri}
                className="flex items-start justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <dt className="text-body-2 text-on-surface">{row.labelFa}</dt>
                  {row.noteFa && (
                    <p className="text-caption text-on-surface-variant mt-0.5">
                      {row.noteFa}
                    </p>
                  )}
                </div>
                <dd className="shrink-0 text-body-2 text-on-surface font-medium tabular-nums">
                  {row.valueFa}
                </dd>
              </div>
            ))}
            {section.totalFa && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-container-high">
                <dt className="text-body-2 text-on-surface font-semibold">جمع</dt>
                <dd className="text-body-2 text-on-surface font-bold tabular-nums">
                  {section.totalFa}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ))}

      {/* نحوه محاسبه */}
      {result.explanationFa && <ExplanationBlock text={result.explanationFa} />}

      {/* مبنای قانونی — collapsible */}
      {result.legalNotesFa && result.legalNotesFa.length > 0 && (
        <LegalNotesBlock notes={result.legalNotesFa} />
      )}

      {/* Provenance */}
      <ProvenanceBlock source={result.source} />
    </div>
  );
}

function ProvenanceBlock({ source }: { source: CalculationResult["source"] }) {
  return (
    <div className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-4">
      <h3 className="text-caption text-on-surface-variant font-medium mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">📖</span>
        منبع و اعتبار داده‌ها
      </h3>
      <dl className="space-y-1.5 text-caption">
        <ProvenanceRow label="سند" value={source.sourceTitle} />
        <ProvenanceRow label="مرجع" value={source.sourceAuthority} />
          <ProvenanceRow
            label="سال محاسبه"
            value={String(source.calculationYear)}
          />
        <ProvenanceRow label="نسخه" value={source.version} />
          <ProvenanceRow
            label="تاریخ بازبینی"
            value={source.verifiedAt}
          />
        {source.sourceUrl && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-on-surface-variant">پیوند:</dt>
              <dd className="min-w-0">
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {source.sourceUrl}
                </a>
              </dd>
            </div>
          )}
        </dl>
      {source.notes && (
          <p className="text-caption text-on-surface-variant mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] leading-relaxed">
          {source.notes}
        </p>
      )}
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

function ExplanationBlock({ text }: { text: string }) {
  return (
    <div className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-4">
      <h3 className="text-body-2 text-on-surface font-semibold mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">🧮</span>
        نحوه محاسبه
      </h3>
      <p className="text-caption text-on-surface-variant leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function LegalNotesBlock({ notes }: { notes: string[] }) {
  return (
    <details className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-4 group">
      <summary className="text-body-2 text-on-surface font-semibold cursor-pointer flex items-center gap-1.5 list-none">
        <span aria-hidden="true">📖</span>
        مبنای قانونی
        <span className="text-caption text-on-surface-variant group-open:hidden">
          (نمایش)
        </span>
      </summary>
      <ul className="mt-3 space-y-1.5" role="list">
        {notes.map((n, i) => (
          <li key={i} className="text-caption text-on-surface-variant">
            {n}
          </li>
        ))}
      </ul>
    </details>
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
