// ============================================================
// LEGALIR — Calculator detail workspace (client)
// ============================================================
// Renders a form from the calculator's own field definitions and runs
// the deterministic engine entirely client-side. No network, no LLM:
// the same input always yields the same output for a dataset version.
//
// The form is generated from `def.fields`, so a new calculator needs
// no change here. This module is the interactive half of the detail
// route; `page.tsx` is the server half that owns metadata + JSON-LD.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TextField, Select, Checkbox, MoneyField } from "@legalir/ui";
import {
  getCalculator,
  runCalculator,
  CalculatorInputError,
  CALCULATOR_CATEGORY_FA,
  CALCULATOR_CONFIDENCE_FA,
  CALCULATOR_STATUS_FA,
  type CalculatorInput,
} from "@/lib/calculators";
import {
  fetchCalculatorPolicy,
  runCalculatorOnServer,
  type CalculatorPolicy,
} from "@/lib/api/calculators";
import type {
  CalculationResult,
  CalculatorDef,
  CalculatorField,
  FieldVisibility,
} from "@legalir/types";
import { toPersianDigits } from "@/lib/persian-utils";

/** Read a user-facing message off an API error object. */
function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-success-50 text-success-700 border-success-200",
  medium: "bg-warning-50 text-warning-700 border-warning-200",
  low: "bg-error-50 text-error-700 border-error-200",
};

const STATUS_TONE: Record<string, string> = {
  legal_basis: "bg-primary-container text-on-primary-container border-[color:var(--color-primary)]",
  official_tariff: "bg-secondary-container text-on-secondary-container border-[color:var(--color-secondary)]",
  estimate: "bg-warning-50 text-warning-700 border-warning-200",
  not_determinable: "bg-error-50 text-error-700 border-error-200",
};

const DEFAULT_DISCLAIMER_FA =
  "نتایج این محاسبه‌گر جنبه اطلاع‌رسانی دارد و جایگزین نظر کارشناس حقوقی نیست.";

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

/** A form with this many (or more) visible groups is split into steps. */
const STEPPER_MIN_GROUPS = 3;

export function CalculatorWorkspace({ slug }: { slug: string }) {
  const calc = getCalculator(slug)!;
  const { def } = calc;

  const [input, setInput] = useState<CalculatorInput>(() =>
    initialInput(def.fields)
  );
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [policy, setPolicy] = useState<CalculatorPolicy | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // §5 — the server-owned operational policy. The client uses it only to pick
  // the UX (local preview vs. charged server run + disabled notice); the SERVER
  // is still the sole authority that enforces the tier, the enabled flag and
  // the energy charge.
  useEffect(() => {
    let alive = true;
    fetchCalculatorPolicy(slug)
      .then((p) => {
        if (alive) setPolicy(p);
      })
      .catch(() => {
        // Policy is advisory to the client; a fetch failure must not block a
        // free calculator, so fall back to the free default.
        if (alive) setPolicy({ slug, enabled: true, accessTier: "free", energyCost: 0 });
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const disabled = policy ? !policy.enabled : false;
  const charged = (policy?.energyCost ?? 0) > 0;

  // Free calculators preview live on every keystroke; a CHARGED run must go
  // through the server (which charges exactly once), so it is not previewed.
  const liveResult = useMemo<CalculationResult | null>(() => {
    if (charged || disabled) return null;
    try {
      const r = runCalculator(slug, input);
      return r;
    } catch {
      return null;
    }
  }, [slug, input, charged, disabled]);

  // Validate locally (for the error message) without exposing a result on a
  // charged calculator — validation is pure and never bills.
  useEffect(() => {
    if (charged || disabled) {
      setError(null);
      return;
    }
    try {
      runCalculator(slug, input);
      setError(null);
    } catch (e) {
      setError(e instanceof CalculatorInputError ? e.message : "خطا در محاسبه");
    }
  }, [slug, input, charged, disabled]);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [chargedCost, setChargedCost] = useState<number | null>(null);

  const setField = (key: string, value: number | string | boolean | undefined) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  async function computeCharged() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await runCalculatorOnServer(
        slug,
        input as Record<string, unknown>
      );
      setResult(res.result);
      setChargedCost(res.energyCost);
    } catch (e) {
      setError(errMessage(e, "اجرای محاسبه ناموفق بود"));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  // What the result panel shows: the live preview (free) or the server result
  // (charged). A charged calculator shows nothing until the user runs it.
  const displayResult = charged ? result : liveResult;

  // Visible groups, in declaration order. A group whose fields are all
  // hidden by progressive disclosure drops out entirely.
  const visibleGroups = groupFields(def.fields)
    .map((g, gi) => ({
      key: g.groupFa ?? `g${gi}`,
      groupFa: g.groupFa,
      fields: g.fields.filter((f) => isVisible(f, input)),
    }))
    .filter((g) => g.fields.length > 0);

  // Complex forms (many groups) are split into steps; simple ones stay
  // a single scroll. `activeStep` is clamped so a group that disappears
  // as the user edits never leaves the stepper pointing past the end.
  const useStepper = visibleGroups.length >= STEPPER_MIN_GROUPS;
  const activeStep = Math.min(step, visibleGroups.length - 1);

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
              {def.status && (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[def.status] ?? CONFIDENCE_TONE[def.confidence]}`}
                >
                  {CALCULATOR_STATUS_FA[def.status]}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_TONE[def.confidence]}`}
              >
                {CALCULATOR_CONFIDENCE_FA[def.confidence]}
              </span>
            </div>
            <p className="text-body-2 text-on-surface-variant mt-1">
              {def.descriptionFa}
            </p>
            <p className="text-caption text-on-surface-variant mt-2 flex items-center gap-1.5 flex-wrap">
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

      {/* Verification banner — shown when the annual figures are not yet
          confirmed against the issuing authority for the calculation year. */}
      {displayResult?.source.verificationStatus === "pending" && (
        <div className="mb-6 rounded-large bg-warning-50 border border-warning-200 p-4 flex items-start gap-3">
          <span className="text-lg shrink-0" aria-hidden="true">🔔</span>
          <div className="min-w-0">
            <p className="text-body-2 text-warning-800 font-semibold">
              ارقام سالانه در انتظار تأیید نهایی
            </p>
            <p className="text-caption text-warning-700 mt-1 leading-relaxed">
              ارقام سالانه این محاسبه‌گر (مانند حداقل مزد، سقف معافیت یا تعرفه) در
              زمان تدوین از منبع رسمی سال {displayResult.source.calculationYear} تأیید نشده و
              بر مبنای آخرین مقدار تأییدشده نگه داشته شده است. پیش از اتکا، مقدار
              رسمی سال جاری را بررسی کنید.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-6 items-start">
        {/* ---- Input form ---- */}
        <section
          className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5 shadow-elevation-1"
          aria-label="ورودی‌های محاسبه"
        >
          <h2 className="text-h3 text-on-surface font-bold mb-4">اطلاعات ورودی</h2>

          {/* Stepper — only for forms with several groups. Shows the
              current step's fields and lets the user move between them. */}
          {useStepper && (
            <div className="mb-5">
              <ol className="flex flex-wrap gap-1.5" role="list">
                {visibleGroups.map((g, gi) => {
                  const isActive = gi === activeStep;
                  return (
                    <li key={g.key}>
                      <button
                        type="button"
                        onClick={() => setStep(gi)}
                        aria-current={isActive ? "step" : undefined}
                        className={`rounded-full border px-3 py-1 text-caption transition-colors duration-short4 ${
                          isActive
                            ? "bg-primary text-white border-[color:var(--color-primary)] font-semibold"
                            : "bg-surface text-on-surface-variant border-[color:var(--color-outline-variant)] hover:border-[color:var(--color-primary)]"
                        }`}
                      >
                        <span className="tabular-nums">{toPersianDigits(gi + 1)}.</span>{" "}
                        {g.groupFa ?? "اطلاعات"}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div
                className="mt-2 h-1 rounded-full bg-surface-container-high overflow-hidden"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={visibleGroups.length}
                aria-valuenow={activeStep + 1}
              >
                <div
                  className="h-full bg-primary transition-all duration-short4 ease-standard"
                  style={{
                    width: `${((activeStep + 1) / visibleGroups.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-6">
            {visibleGroups.map((group, gi) => {
              // In stepper mode only the active group renders; otherwise
              // every group renders in one scroll.
              if (useStepper && gi !== activeStep) return null;
              return (
                <fieldset key={group.key} className="space-y-4">
                  {group.groupFa && (
                    <legend className="text-body-2 text-primary font-semibold mb-1">
                      {group.groupFa}
                    </legend>
                  )}
                  {group.fields.map((field) => (
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

          {/* Stepper navigation */}
          {useStepper && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className="rounded-medium border border-[color:var(--color-outline-variant)] px-4 py-2 text-button text-on-surface disabled:opacity-40 hover:border-[color:var(--color-primary)] transition-colors duration-short4"
              >
                مرحله قبل
              </button>
              <span className="text-caption text-on-surface-variant tabular-nums">
                مرحله {toPersianDigits(activeStep + 1)} از {toPersianDigits(visibleGroups.length)}
              </span>
              <button
                type="button"
                onClick={() => setStep(Math.min(visibleGroups.length - 1, activeStep + 1))}
                disabled={activeStep === visibleGroups.length - 1}
                className="rounded-medium bg-primary text-white px-4 py-2 text-button font-medium disabled:opacity-40 hover:bg-primary-700 transition-colors duration-short4"
              >
                مرحله بعد
              </button>
            </div>
          )}
        </section>

        {/* ---- Result ---- */}
        <section
          className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5 shadow-elevation-1 desktop:sticky desktop:top-6"
          aria-label="نتیجه محاسبه"
          aria-live="polite"
        >
          <h2 className="text-h3 text-on-surface font-bold mb-4">نتیجه</h2>

          {disabled ? (
            <div className="rounded-medium bg-surface-container-high border border-[color:var(--color-outline-variant)] p-4 text-body-2 text-on-surface-variant">
              این محاسبه‌گر موقتاً توسط مدیر غیرفعال شده است.
            </div>
          ) : error ? (
            <div className="rounded-medium bg-error-50 border border-error-200 p-4 text-body-2 text-error-700">
              {error}
            </div>
          ) : displayResult ? (
            <>
              {charged && chargedCost !== null && (
                <div className="mb-3 rounded-medium bg-primary/5 border border-primary-200 p-3 text-caption text-on-surface-variant">
                  {chargedCost > 0
                    ? `هزینهٔ این اجرا: ${toPersianDigits(chargedCost)} امتیاز انرژی کسر شد.`
                    : "این اجرا بدون هزینهٔ اضافی ثبت شد (پیش‌تر همین امروز محاسبه شده است)."}
                </div>
              )}
              <ResultView result={displayResult} />
            </>
          ) : charged ? (
            <div className="space-y-4">
              <p className="text-body-2 text-on-surface-variant leading-relaxed">
                این محاسبه‌گر دارای هزینهٔ انرژی است و هنگام اجرا از اعتبار شما کسر
                می‌شود. با زدن دکمهٔ زیر محاسبه انجام و نتیجه نمایش داده می‌شود.
              </p>
              <button
                type="button"
                onClick={computeCharged}
                disabled={submitting}
                className="w-full rounded-medium bg-primary text-white px-4 py-2.5 text-button font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {submitting
                  ? "در حال محاسبه…"
                  : `محاسبه (${toPersianDigits(policy?.energyCost ?? 0)} امتیاز انرژی)`}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {/* ---- SEO / explanatory content ---- */}
      <SeoContentBlock def={def} />

      {/* ---- Cross-links to related calculators ---- */}
      <RelatedCalculatorsBlock slugs={def.relatedSlugs} />

      {/* ---- Next action — never a dead end ---- */}
      {def.nextAction && (
        <div className="mt-8 rounded-large bg-gradient-to-br from-primary-700 to-primary-900 text-white p-6 shadow-elevation-2 flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
          <p className="text-body-1 font-medium">{def.nextAction.promptFa}</p>
          <Link
            href={def.nextAction.href}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-medium bg-white text-primary-800 px-5 py-2.5 text-button font-semibold hover:bg-white/90 transition-colors active:scale-[0.98]"
          >
            {def.nextAction.labelFa}
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      )}

      {/* ---- Per-calculator disclaimer ---- */}
      <p className="text-caption text-on-surface-variant text-center mt-8 leading-relaxed">
        {def.disclaimerFa ?? DEFAULT_DISCLAIMER_FA}
      </p>
    </div>
  );
}

// ============================================================
// SEO / explanatory content — «این محاسبه‌گر چیست؟» etc.
// ============================================================

function SeoContentBlock({ def }: { def: CalculatorDef }) {
  const hasContent =
    def.aboutFa ||
    def.howItWorksFa ||
    def.requiredInfoFa ||
    def.determinacyFa ||
    (def.faq && def.faq.length > 0);
  if (!hasContent) return null;

  return (
    <section className="mt-8 space-y-4" aria-label="راهنمای محاسبه‌گر">
      <h2 className="text-h3 text-on-surface font-bold">
        درباره این محاسبه‌گر
      </h2>

      {def.aboutFa && (
        <SeoItem icon="ℹ️" title="این محاسبه‌گر چیست؟" text={def.aboutFa} />
      )}
      {def.howItWorksFa && (
        <SeoItem icon="🧮" title="چگونه محاسبه می‌شود؟" text={def.howItWorksFa} />
      )}
      {def.requiredInfoFa && (
        <SeoItem icon="📝" title="چه اطلاعاتی نیاز است؟" text={def.requiredInfoFa} />
      )}
      {def.determinacyFa && (
        <SeoItem icon="🎯" title="آیا نتیجه قطعی است؟" text={def.determinacyFa} />
      )}

      {def.faq && def.faq.length > 0 && (
        <div className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5">
          <h3 className="text-body-1 text-on-surface font-semibold mb-3">
            پرسش‌های متداول
          </h3>
          <div className="space-y-2">
            {def.faq.map((item, i) => (
              <details
                key={i}
                className="rounded-medium bg-surface border border-[color:var(--color-outline-variant)] p-3 group"
              >
                <summary className="text-body-2 text-on-surface font-medium cursor-pointer list-none flex items-center justify-between gap-2">
                  <span>{item.qFa}</span>
                  <span
                    className="text-on-surface-variant group-open:rotate-180 transition-transform duration-short4"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </summary>
                <p className="text-caption text-on-surface-variant mt-2 leading-relaxed">
                  {item.aFa}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SeoItem({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-5">
      <h3 className="text-body-1 text-on-surface font-semibold mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <p className="text-caption text-on-surface-variant leading-relaxed">{text}</p>
    </div>
  );
}

// ============================================================
// Related calculators — cross-linking
// ============================================================

function RelatedCalculatorsBlock({ slugs }: { slugs?: string[] }) {
  if (!slugs || slugs.length === 0) return null;

  const related = slugs
    .map((s) => getCalculator(s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (related.length === 0) return null;

  return (
    <section className="mt-8" aria-label="محاسبه‌گرهای مرتبط">
      <h2 className="text-h3 text-on-surface font-bold mb-3">
        محاسبه‌گرهای مرتبط
      </h2>
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
        {related.map(({ def }) => (
          <Link
            key={def.slug}
            href={`/calculators/${def.slug}`}
            className="group rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] p-4 shadow-elevation-1 hover:shadow-elevation-3 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] transition-all duration-short4 ease-standard active:scale-[0.98] flex items-center gap-3"
          >
            <span
              className={`h-10 w-10 shrink-0 rounded-medium bg-gradient-to-br ${def.gradient} flex items-center justify-center text-lg`}
              aria-hidden="true"
            >
              {def.icon}
            </span>
            <div className="min-w-0">
              <p className="text-body-2 text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                {def.titleFa}
              </p>
              <p className="text-caption text-on-surface-variant truncate">
                {def.subtitleFa}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
          {result.headlineLabelFa ?? "مبلغ نهایی"}
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
