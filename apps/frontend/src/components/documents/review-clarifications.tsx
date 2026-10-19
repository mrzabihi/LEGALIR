// ============================================================
// LEGALIR — Review clarifications (step-by-step follow-up questions)
// ============================================================
// When the analysis cannot settle a point because something is missing
// from the document, the honest response is to ASK — not to fill the gap
// with a guess.
//
// This component asks the questions `buildFollowUpQuestions` derived
// from real gaps, ONE AT A TIME, and then hands the accumulated answers
// to the document chat as a single message (`composeFollowUpMessage`).
//
// Rules that keep the questioning honest and non-repetitive:
//   • a question exists only for a real gap (an `incomplete_info`
//     finding, or a report with no citation at all);
//   • an answered question is remembered per document (localStorage), so
//     a reload never re-asks it;
//   • «رد کردن» is a first-class answer — the user is never forced to
//     answer, and a skipped question is not asked again;
//   • answering is optional, so this card never blocks the result;
//   • at most four questions, so the user is never interrogated.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RiskReport } from "@legalir/types";
import { Button, Card, Textarea } from "@legalir/ui";
import {
  buildFollowUpQuestions,
  composeFollowUpMessage,
  type FollowUpAnswer,
} from "@/lib/documents/review-insights";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconChat, IconInfo, IconSend } from "@/lib/icons";

const STORAGE_PREFIX = "legalir:review-followups:";

function readAnswered(documentId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${documentId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    );
  } catch {
    return new Set();
  }
}

function writeAnswered(documentId: string, answered: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${documentId}`,
      JSON.stringify(Array.from(answered))
    );
  } catch {
    // Storage can be unavailable (private mode / quota). The in-memory
    // state still prevents repeats for this visit.
  }
}

interface ReviewClarificationsProps {
  documentId: string;
  report: RiskReport | null;
  /**
   * Sends the composed answers to the document chat. Required — without a
   * real channel to send them, asking would be pointless.
   */
  onSend: (message: string) => void | Promise<void>;
  /** True while a previous message is still being answered. */
  busy?: boolean;
  className?: string;
}

export function ReviewClarifications({
  documentId,
  report,
  onSend,
  busy = false,
  className = "",
}: ReviewClarificationsProps) {
  // Read storage after mount so the first paint is identical on both sides.
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnswered(readAnswered(documentId));
    setHydrated(true);
  }, [documentId]);

  const questions = useMemo(
    () => buildFollowUpQuestions(report, answered),
    [report, answered]
  );

  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [collecting, setCollecting] = useState<FollowUpAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the walk when the question set itself changes (a new analysis).
  const questionKey = questions.map((question) => question.id).join("|");
  useEffect(() => {
    setIndex(0);
    setDraft("");
    setCollecting([]);
    setSent(false);
    setError(null);
  }, [questionKey]);

  const markAnswered = useCallback(
    (ids: string[]) => {
      setAnswered((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        writeAnswered(documentId, next);
        return next;
      });
    },
    [documentId]
  );

  if (!hydrated || questions.length === 0 || sent) return null;

  const question = questions[index];
  // The index can outlive a report change for one render; treat that as
  // "nothing to ask" rather than reading a missing question.
  if (!question) return null;
  const isLast = index === questions.length - 1;

  const submit = async (answers: FollowUpAnswer[]) => {
    const message = composeFollowUpMessage(answers);
    // Every question has been dealt with (answered or skipped), so none of
    // them may be asked again for this document.
    markAnswered(questions.map((q) => q.id));

    if (!message) {
      // Everything was skipped — nothing to send, but the questions are
      // still retired so the card does not nag.
      setSent(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSend(message);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ارسال پاسخ‌ها انجام نشد. لطفاً دوباره تلاش کنید."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    const answer = draft.trim();
    const collected = answer
      ? [...collecting, { promptFa: question.promptFa, answerFa: answer }]
      : collecting;

    if (isLast) {
      void submit(collected);
      return;
    }
    setCollecting(collected);
    setDraft("");
    setIndex((current) => current + 1);
  };

  const handleSkip = () => {
    markAnswered([question.id]);
    if (isLast) {
      void submit(collecting);
      return;
    }
    setDraft("");
    setIndex((current) => current + 1);
  };

  const pending = busy || submitting;

  return (
    <Card variant="outlined" padding="medium" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary"
        >
          <IconChat size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-titleSmall text-on-surface">
            چند پرسش برای دقیق‌تر شدن بررسی
          </h3>
          <p className="mt-0.5 text-caption leading-relaxed text-muted">
            بررسی این سند در چند مورد به اطلاعاتی نیاز دارد که در متن نبود. پاسخ
            شما به همان بررسی اضافه می‌شود و پرسش‌های تکراری پرسیده نمی‌شود.
          </p>
        </div>
        <span className="shrink-0 text-caption text-muted" aria-live="polite">
          {toPersianNumber(index + 1)} از {toPersianNumber(questions.length)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 rounded-medium bg-surface-container p-3">
        <p className="text-body-2 font-medium text-on-surface">{question.promptFa}</p>
        {question.contextFa && (
          <p className="text-caption leading-relaxed text-muted">{question.contextFa}</p>
        )}
      </div>

      <Textarea
        label="پاسخ شما"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        autoResize
        fullWidth
        disabled={pending}
        supportingText="اگر پاسخ را نمی‌دانید، می‌توانید این پرسش را رد کنید."
      />

      {error && (
        <p className="text-caption text-error" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-caption text-muted">
          <IconInfo size={14} aria-hidden="true" />
          پاسخ‌ها فقط به بررسی همین سند اضافه می‌شوند.
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={handleSkip}
            disabled={pending}
          >
            رد کردن
          </Button>
          <Button
            type="button"
            size="small"
            onClick={handleNext}
            loading={pending}
            disabled={pending}
            startIcon={isLast ? <IconSend size={16} /> : undefined}
          >
            {isLast ? "ارسال پاسخ‌ها" : "ذخیره و پرسش بعدی"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
