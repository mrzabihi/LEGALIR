"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FollowUpAnswer, FollowUpQuestion } from "@legalir/types";
import { Button } from "@legalir/ui";
import { IconChevronDown, IconInfo } from "@/lib/icons";

/**
 * The structured follow-up panel that sits with the composer.
 *
 * Every question here was produced by the backend's workflow engine from a
 * real gap (a fact it has not been told). The panel never invents a question
 * and never fills a missing fact with a guess:
 *
 *  • quick options are shown only when the answer is genuinely enumerable;
 *  • a free-form field is always available next to them;
 *  • «اطلاع ندارم» and «بعداً» are first-class choices — the user is never
 *    forced to answer;
 *  • the mandatory-item reason (`whyFa`) is shown, so asking is justified;
 *  • nothing is sent until the user presses «ارسال پاسخ‌ها», and the answers
 *    travel as structured `followUpAnswers` on the next real turn.
 */
const UNKNOWN_ANSWER_FA = "اطلاع ندارم";

export interface FollowUpPanelProps {
  questions: FollowUpQuestion[];
  /** Sends the composed message plus the structured answers. */
  onSubmit: (content: string, answers: FollowUpAnswer[]) => void | Promise<void>;
  /** True while the assistant is generating — answers wait for the turn. */
  busy?: boolean;
  /** True when the conversation itself is read-only (archived). */
  disabled?: boolean;
}

function composeMessage(
  questions: FollowUpQuestion[],
  answers: Record<string, string>
): string {
  const lines = questions
    .filter((q) => answers[q.id])
    .map((q) => `• ${q.questionFa}\n${answers[q.id]}`);
  return `پاسخ پرسش‌های تکمیلی:\n${lines.join("\n\n")}`;
}

export function FollowUpPanel({
  questions,
  onSubmit,
  busy = false,
  disabled = false,
}: FollowUpPanelProps) {
  // Stable identity for the current question set — a new turn produces new
  // questions, which resets the working answers.
  const questionKey = useMemo(
    () => questions.map((q) => q.id).join("|"),
    [questions]
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAnswers({});
    setOpen(true);
  }, [questionKey]);

  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const pending = busy || submitting || disabled;

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value.trim() }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const payload: FollowUpAnswer[] = questions
      .filter((q) => answers[q.id])
      .map((q) => ({ id: q.id, value: answers[q.id]! }));
    if (payload.length === 0) return;

    setSubmitting(true);
    try {
      await onSubmit(composeMessage(questions, answers), payload);
      setAnswers({});
    } finally {
      setSubmitting(false);
    }
  }, [questions, answers, onSubmit]);

  if (questions.length === 0) return null;

  return (
    <section
      aria-label="پرسش‌های تکمیلی"
      className="shrink-0 border-t border-divider bg-surface px-3 pt-2"
    >
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-medium px-1 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-caption text-muted">پرسش‌های تکمیلی</span>
            <span className="text-caption text-onSurface">
              {answeredCount > 0
                ? `${answeredCount} پاسخ آماده ارسال`
                : `${questions.length} پرسش`}
            </span>
          </span>
          <IconChevronDown
            size={16}
            className={[
              "shrink-0 text-muted transition-transform motion-reduce:transition-none",
              open ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            className="max-h-[38vh] space-y-2 overflow-y-auto pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            <p className="flex items-start gap-1.5 px-1 text-caption leading-relaxed text-muted">
              <IconInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              این پرسش‌ها فقط برای اطلاعاتی است که هنوز در گفتگو روشن نیست. پاسخ‌ها فقط به همین گفتگو اضافه می‌شوند.
            </p>

            {questions.map((question) => {
              const value = answers[question.id] ?? "";
              const isSkipped = value === UNKNOWN_ANSWER_FA;
              return (
                <div
                  key={question.id}
                  className="rounded-medium border border-divider bg-background p-3"
                >
                  <p className="text-bodyMedium text-onSurface">
                    {question.questionFa}
                    {question.required && (
                      <>
                        {/* The asterisk is decorative; the requirement is spoken. */}
                        <span className="ms-1 text-caption text-error" aria-hidden="true">
                          *
                        </span>
                        <span className="sr-only"> الزامی</span>
                      </>
                    )}
                  </p>
                  {question.whyFa && (
                    <p className="mt-1 text-caption leading-relaxed text-muted">
                      {question.whyFa}
                    </p>
                  )}

                  {question.quickOptionsFa.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {question.quickOptionsFa.map((option) => {
                        const selected = value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAnswer(question.id, selected ? "" : option.value)}
                            aria-pressed={selected}
                            disabled={pending}
                            className={[
                              "min-h-9 rounded-full border px-3 text-caption transition-colors motion-reduce:transition-none",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                              selected
                                ? "border-primary bg-primary-container text-primary"
                                : "border-divider bg-surface text-onSurface hover:bg-surface-hover",
                              pending ? "cursor-not-allowed opacity-60" : "",
                            ].join(" ")}
                          >
                            {option.labelFa}
                            {selected && <span aria-hidden="true"> ✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={isSkipped ? "" : value}
                      onChange={(e) => setAnswer(question.id, e.target.value)}
                      placeholder={isSkipped ? UNKNOWN_ANSWER_FA : "پاسخ خود را بنویسید…"}
                      disabled={pending}
                      aria-label={`پاسخ: ${question.questionFa}`}
                      className={[
                        "min-h-9 flex-1 rounded-medium border border-divider bg-surface px-3 py-1.5",
                        "text-caption text-onSurface placeholder:text-muted",
                        "focus:border-primary focus:outline-2 focus:outline-primary",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                      ].join(" ")}
                    />
                    <button
                      type="button"
                      onClick={() => setAnswer(question.id, UNKNOWN_ANSWER_FA)}
                      aria-pressed={isSkipped}
                      disabled={pending}
                      className={[
                        "min-h-9 shrink-0 rounded-full border px-3 text-caption transition-colors motion-reduce:transition-none",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        isSkipped
                          ? "border-primary bg-primary-container text-primary"
                          : "border-divider bg-surface text-muted hover:bg-surface-hover",
                        pending ? "cursor-not-allowed opacity-60" : "",
                      ].join(" ")}
                    >
                      {UNKNOWN_ANSWER_FA}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-caption text-muted" aria-live="polite">
                {answeredCount > 0
                  ? `${answeredCount} پاسخ ثبت می‌شود`
                  : "بدون پاسخ هم می‌توانید پیام بفرستید"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  بعداً
                </Button>
                <Button
                  type="button"
                  size="small"
                  onClick={() => void handleSubmit()}
                  loading={submitting}
                  disabled={pending || answeredCount === 0}
                >
                  ارسال پاسخ‌ها
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
