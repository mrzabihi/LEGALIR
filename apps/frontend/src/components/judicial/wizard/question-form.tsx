// ============================================================
// LEGALIR — Judicial questionnaire step form
// ============================================================
// Renders ONE questionnaire VERSION at a time (the version the request was
// created against, resolved server-side), one schema step at a time.
//
// Three rules this form keeps:
//   • a conditional question is shown by the SAME rule the server uses
//     (`isQuestionVisible`), so a hidden required question can never block the
//     user and a visible one can never be skipped;
//   • saving sends ONLY the current step's visible answers — the route replaces
//     just those rows, so editing one section never erases another;
//   • every save is version-pinned. A 409 means the form is stale, and the
//     honest remedy is to reload — the local copy is never silently merged.
//
// Sensitive questions carry an on-demand «چرا این را می‌پرسیم؟» disclosure; the
// reason text is authored with the question, not invented here.
// ============================================================

"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Select,
  SegmentedControl,
  TextField,
  Textarea,
} from "@legalir/ui";
import type {
  JudicialCompleteness,
  JudicialQuestion,
  JudicialQuestionnaire,
} from "@legalir/types";
import { JalaliDatePicker } from "@/components/shared/JalaliDatePicker";
import { IconInfo, IconWarning } from "@/lib/icons";
import { useSaveJudicialAnswers } from "@/hooks/useJudicial";
import {
  answerProgress,
  firstIncompleteStep,
  isQuestionVisible,
} from "@/lib/judicial/schemas";
import { fromPersianDigits, toPersianDigits } from "@/lib/persian-utils";

const BOOLEAN_SEGMENTS = [
  { value: "true", label: "بله" },
  { value: "false", label: "خیر" },
];

/** The label of a multiselect value, falling back to the raw value. */
function optionLabel(question: JudicialQuestion, value: string): string {
  return question.options?.find((o) => o.value === value)?.labelFa ?? value;
}

export interface QuestionFormProps {
  requestId: string;
  questionnaire: JudicialQuestionnaire;
  /** The flat answers the server currently holds for this request. */
  initialAnswers: Record<string, string>;
  completeness: JudicialCompleteness;
  /** Advance to the next wizard stage (documents). */
  onDone: () => void;
  /** Re-read the request after a version conflict. */
  onReload: () => void;
  /** Jump back to the family picker when the boundary is still open. */
  onRevisitKind: () => void;
}

export function QuestionForm({
  requestId,
  questionnaire,
  initialAnswers,
  completeness,
  onDone,
  onReload,
  onRevisitKind,
}: QuestionFormProps) {
  const save = useSaveJudicialAnswers(requestId);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [stepId, setStepId] = useState<string>(() => {
    const first = firstIncompleteStep(questionnaire, initialAnswers);
    return first?.id ?? questionnaire.steps[0]?.id ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  if (questionnaire.steps.length === 0) {
    return (
      <section className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5">
        <p className="text-body-2 text-on-surface">
          پرسش‌نامهٔ این درخواست هنوز مشخص نیست، چون نوع سند انتخاب نشده است.
        </p>
        <Button variant="outlined" className="mt-3" onClick={onRevisitKind}>
          انتخاب نوع سند
        </Button>
      </section>
    );
  }

  const stepIndex = Math.max(
    0,
    questionnaire.steps.findIndex((s) => s.id === stepId)
  );
  const step = questionnaire.steps[stepIndex]!;
  const visibleFields = step.fields.filter((f) => isQuestionVisible(f, answers));
  const progress = answerProgress(questionnaire, answers);

  const missingRequired = visibleFields.filter(
    (f) => f.required && !answers[f.id]?.trim()
  );

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function persist(andAdvance: boolean) {
    if (!step) return;
    if (missingRequired.length > 0) {
      setError(
        `پیش از ادامه، این پرسش‌ها را پاسخ دهید: ${missingRequired
          .map((f) => f.labelFa)
          .join("، ")}`
      );
      return;
    }

    setError(null);
    setStale(false);

    // Only the visible answers of THIS step: the route treats the body as the
    // complete truth for the step, so an omitted field is a cleared field.
    const payload: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = answers[field.id]?.trim();
      if (value) payload[field.id] = value;
    }

    try {
      await save.mutateAsync({
        stepId: step.id,
        answers: payload,
        questionnaireVersion: questionnaire.version,
      });
      if (andAdvance) {
        const next = questionnaire.steps[stepIndex + 1];
        if (next) setStepId(next.id);
        else onDone();
      }
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      const message =
        e instanceof Error ? e.message : "ذخیرهٔ پاسخ‌ها ناموفق بود.";
      setStale(code === "VERSION_MISMATCH");
      setError(message);
    }
  }

  function renderField(question: JudicialQuestion) {
    const value = answers[question.id] ?? "";
    const supporting = question.helpFa;

    switch (question.type) {
      case "textarea":
        return (
          <Textarea
            key={question.id}
            label={question.labelFa}
            value={value}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            rows={4}
            fullWidth
            maxLength={4000}
            showCharCount
            placeholder={question.placeholderFa}
            supportingText={supporting}
          />
        );

      case "select":
        return (
          <Select
            key={question.id}
            label={question.labelFa}
            value={value}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            fullWidth
            supportingText={supporting}
            options={[
              { value: "", label: "انتخاب کنید" },
              ...(question.options ?? []).map((o) => ({
                value: o.value,
                label: o.labelFa,
              })),
            ]}
          />
        );

      case "multiselect": {
        const selected = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        return (
          <fieldset
            key={question.id}
            className="rounded-medium border border-[color:var(--color-outline-variant)] p-3"
          >
            <legend className="px-1 text-labelLarge text-on-surface">
              {question.labelFa}
            </legend>
            <div className="mt-1 grid grid-cols-1 gap-2 tablet:grid-cols-2">
              {(question.options ?? []).map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <Checkbox
                    key={option.value}
                    label={option.labelFa}
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? selected.filter((v) => v !== option.value)
                        : [...selected, option.value];
                      setAnswer(question.id, next.join(","));
                    }}
                  />
                );
              })}
            </div>
            {selected.length > 0 && (
              <p className="mt-2 text-caption text-on-surface-variant">
                انتخاب‌شده: {selected.map((v) => optionLabel(question, v)).join("، ")}
              </p>
            )}
            {supporting && (
              <p className="mt-1 text-caption text-on-surface-variant">{supporting}</p>
            )}
          </fieldset>
        );
      }

      case "boolean":
        return (
          <div key={question.id}>
            <p className="mb-1.5 text-labelLarge text-on-surface">
              {question.labelFa}
            </p>
            <SegmentedControl
              segments={BOOLEAN_SEGMENTS}
              value={value}
              onChange={(v) => setAnswer(question.id, v)}
              idBase={`judicial-q-${question.id}`}
              ariaLabel={question.labelFa}
            />
            {supporting && (
              <p className="mt-1 text-caption text-on-surface-variant">{supporting}</p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={question.id}>
            <p className="mb-1.5 text-labelLarge text-on-surface">
              {question.labelFa}
            </p>
            <JalaliDatePicker
              value={value}
              onChange={(v) => setAnswer(question.id, v)}
              showSelected={false}
            />
            {supporting && (
              <p className="mt-1 text-caption text-on-surface-variant">{supporting}</p>
            )}
          </div>
        );

      case "currency":
        return (
          <TextField
            key={question.id}
            label={question.labelFa}
            value={value ? toPersianDigits(value) : ""}
            onChange={(e) =>
              setAnswer(
                question.id,
                fromPersianDigits(e.target.value).replace(/[^\d]/g, "")
              )
            }
            inputMode="numeric"
            fullWidth
            placeholder={question.placeholderFa}
            supportingText={supporting ?? "مبلغ را به ریال بنویسید."}
          />
        );

      default:
        return (
          <TextField
            key={question.id}
            label={question.labelFa}
            value={value}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            fullWidth
            maxLength={4000}
            placeholder={question.placeholderFa}
            supportingText={supporting}
          />
        );
    }
  }

  return (
    <section
      aria-labelledby="judicial-questionnaire-title"
      className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="judicial-questionnaire-title"
          className="text-titleMedium text-on-surface"
        >
          {questionnaire.titleFa || "پرسش‌نامه"}
        </h2>
        <span className="text-caption text-on-surface-variant">
          {progress.answered.toLocaleString("fa-IR")} از{" "}
          {progress.total.toLocaleString("fa-IR")} پاسخ ضروری{" · "}نسخهٔ{" "}
          {questionnaire.version.toLocaleString("fa-IR")}
        </span>
      </div>
      {questionnaire.descriptionFa && (
        <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
          {questionnaire.descriptionFa}
        </p>
      )}

      {/* Contradictions are computed server-side from the stored answers. */}
      {completeness.contradictions.length > 0 && (
        <div className="mt-3 rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
          <p className="flex items-center gap-1.5 font-medium">
            <IconWarning size={15} className="shrink-0" />
            پاسخ‌های شما در این موارد با هم سازگار نیست:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pe-5">
            {completeness.contradictions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sub-step rail. Each schema step is saved on its own. */}
      <div className="mt-4">
        <SegmentedControl
          segments={questionnaire.steps.map((s) => ({
            value: s.id,
            label: s.titleFa,
          }))}
          value={step.id}
          onChange={setStepId}
          idBase="judicial-questionnaire"
          ariaLabel="بخش‌های پرسش‌نامه"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-titleSmall text-on-surface">{step.titleFa}</h3>
        {step.descriptionFa && (
          <p className="mt-0.5 text-body-2 text-on-surface-variant">
            {step.descriptionFa}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {visibleFields.map((question) => (
          <div key={question.id}>
            {renderField(question)}
            {question.sensitive && question.whyFa && (
              <details className="mt-1.5 text-caption text-on-surface-variant">
                <summary className="cursor-pointer text-primary">
                  چرا این اطلاعات را می‌پرسیم؟
                </summary>
                <p className="mt-1 flex items-start gap-1.5 leading-6">
                  <IconInfo size={14} className="mt-1 shrink-0" />
                  {question.whyFa}
                </p>
              </details>
            )}
          </div>
        ))}
        {visibleFields.length === 0 && (
          <p className="text-body-2 text-on-surface-variant">
            در این بخش، بر اساس پاسخ‌های پیشین، پرسشی برای نمایش نیست.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          <p>{error}</p>
          {stale && (
            <Button variant="outlined" size="small" className="mt-2" onClick={onReload}>
              بازخوانی پرسش‌نامه
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void persist(true)} loading={save.isPending}>
          {stepIndex === questionnaire.steps.length - 1
            ? "ذخیره و ادامه به مدارک"
            : "ذخیره و بخش بعدی"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => void persist(false)}
          disabled={save.isPending}
        >
          فقط ذخیره
        </Button>
        {stepIndex > 0 && (
          <Button
            variant="text"
            onClick={() => setStepId(questionnaire.steps[stepIndex - 1]!.id)}
            disabled={save.isPending}
          >
            بخش قبلی
          </Button>
        )}
      </div>

      <p className="mt-3 text-caption leading-6 text-on-surface-variant">
        {questionnaire.disclaimerFa}
      </p>
    </section>
  );
}
