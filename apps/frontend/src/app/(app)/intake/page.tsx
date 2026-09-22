// ============================================================
// LEGALIR — Legal Intake Wizard (PART 5)
// ============================================================
// Step 1: pick a legal category (cards). Step 2+: the 9-step wizard
// rendered entirely from the versioned schema returned by the API. The
// draft is persisted after every step so the user can leave and resume.
// ============================================================

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TextField, Textarea, Select } from "@legalir/ui";
import {
  useIntakeSchema,
  useIntakeDrafts,
  useCreateIntakeDraft,
  useUpdateIntakeDraft,
} from "@/hooks/useIntake";
import { IconArrowBack, IconArrowForward, IconCheck, IconInfo } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { LEGAL_CATEGORY_FA, type IntakeField } from "@legalir/types";

const CATEGORY_OPTIONS = Object.entries(LEGAL_CATEGORY_FA);

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: IntakeField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {field.type === "textarea" ? (
        <Textarea
          label={field.labelFa}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholderFa}
          rows={4}
          fullWidth
          supportingText={field.helpFa}
        />
      ) : field.type === "select" ? (
        <Select
          label={field.labelFa}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="انتخاب کنید…"
          fullWidth
          supportingText={field.helpFa}
          options={(field.options ?? []).map((o) => ({ value: o.value, label: o.labelFa }))}
        />
      ) : field.type === "multiselect" ? (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const selected = value.split(",").filter(Boolean).includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  const set = new Set(value.split(",").filter(Boolean));
                  if (selected) set.delete(o.value);
                  else set.add(o.value);
                  onChange([...set].join(","));
                }}
                className={[
                  "rounded-full border px-3 py-1.5 text-caption transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary-700"
                    : "border-divider/60 bg-surface text-muted hover:border-primary/40",
                ].join(" ")}
              >
                {o.labelFa}
              </button>
            );
          })}
        </div>
      ) : field.type === "boolean" ? (
        <div className="flex gap-2">
          {[
            { v: "true", label: "بله" },
            { v: "false", label: "خیر" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              className={[
                "rounded-xl border px-5 py-2 text-body-2 transition-colors",
                value === opt.v
                  ? "border-primary bg-primary/10 text-primary-700"
                  : "border-divider/60 bg-surface text-muted hover:border-primary/40",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <TextField
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"}
          label={field.labelFa}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholderFa}
          fullWidth
          supportingText={field.helpFa}
        />
      )}

      {(field.type === "multiselect" || field.type === "boolean") && field.helpFa && (
        <p className="text-caption text-muted">{field.helpFa}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

function Wizard({ category, onExit }: { category: string; onExit: () => void }) {
  const { data: schema, isLoading } = useIntakeSchema(category);
  const createDraft = useCreateIntakeDraft();
  const updateDraft = useUpdateIntakeDraft();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Lazily create the draft on first interaction with the wizard.
  async function ensureDraft(): Promise<string | null> {
    if (draftId) return draftId;
    try {
      const d = await createDraft.mutateAsync(category);
      setDraftId(d.id);
      return d.id;
    } catch {
      return null;
    }
  }

  const step = schema?.steps[stepIndex];
  const isLast = schema ? stepIndex === schema.steps.length - 1 : false;

  const visibleFields = useMemo(() => {
    if (!step) return [];
    return step.fields.filter((f) => {
      if (!f.showWhen) return true;
      const current = answers[f.showWhen.field];
      const expected = Array.isArray(f.showWhen.equals) ? f.showWhen.equals : [f.showWhen.equals];
      return current !== undefined && expected.includes(current);
    });
  }, [step, answers]);

  function validateStep(): boolean {
    if (!step) return true;
    for (const f of visibleFields) {
      if (f.required && !answers[f.key]?.trim()) {
        setError(`پاسخ به «${f.labelFa}» الزامی است`);
        return false;
      }
    }
    setError(null);
    return true;
  }

  async function handleNext() {
    if (!validateStep()) return;
    const id = await ensureDraft();
    if (id) {
      updateDraft.mutate({ id, patch: { currentStep: stepIndex + 1, answers, savedAt: new Date().toISOString() } });
    }
    setStepIndex((i) => i + 1);
  }

  function handleBack() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (isLoading || !schema || !step) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />;
  }

  return (
    <div className="rounded-2xl border border-divider/60 bg-surface p-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-caption text-muted">
          <span>
            گام {toPersianNumber(stepIndex + 1)} از {toPersianNumber(schema.steps.length)}
          </span>
          <span>{schema.titleFa}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-divider/60">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / schema.steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="mb-1 text-h3 text-on-surface">{step.titleFa}</h2>
      {step.descriptionFa && <p className="mb-5 text-body-2 text-muted">{step.descriptionFa}</p>}

      {isLast ? (
        <div className="rounded-xl bg-primary/5 p-4 text-body-2 text-on-surface">
          <p className="mb-2 font-semibold">خلاصه پاسخ‌های شما</p>
          <ul className="space-y-1 text-muted">
            {Object.entries(answers).map(([k, v]) => (
              <li key={k}>
                <span className="text-on-surface">{k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleFields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={answers[f.key] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))}
            />
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-body-2 text-error">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={stepIndex === 0 ? onExit : handleBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-divider/60 px-4 py-2.5 text-body-2 text-on-surface transition hover:bg-surface-hover"
        >
          <IconArrowBack size={18} />
          {stepIndex === 0 ? "تغییر دسته" : "مرحله قبل"}
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={async () => {
              const id = await ensureDraft();
              if (id) {
                updateDraft.mutate({ id, patch: { answers, savedAt: new Date().toISOString() } });
              }
              onExit();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
          >
            <IconCheck size={18} />
            ثبت و دریافت تحلیل
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
          >
            مرحله بعد
            <IconArrowForward size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntakePage() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const { data: drafts } = useIntakeDrafts();

  return (
    <div className="mx-auto max-w-3xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="mb-2 text-h2 text-on-surface">پرسش‌نامه حقوقی</h1>
        <p className="text-body-2 text-muted">
          با پاسخ به چند پرسش، اطلاعات لازم برای تحلیل دقیق و مستند جمع‌آوری می‌شود.
        </p>
      </div>

      {category ? (
        <Wizard category={category} onExit={() => router.push("/dashboard")} />
      ) : (
        <>
          {drafts && drafts.length > 0 && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-body-2 font-semibold text-on-surface">
                <IconInfo size={18} className="text-primary" />
                پیش‌نویس‌های ناتمام
              </p>
              <ul className="space-y-1.5">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setCategory(d.category)}
                      className="text-body-2 text-primary hover:underline"
                    >
                      {LEGAL_CATEGORY_FA[d.category] ?? d.category} — گام {toPersianNumber(d.currentStep + 1)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            {CATEGORY_OPTIONS.map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setCategory(code)}
                className="rounded-2xl border border-divider/60 bg-surface p-5 text-start transition-all hover:border-primary/40 hover:shadow-elevation-1"
              >
                <span className="text-body-1 font-semibold text-on-surface">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
