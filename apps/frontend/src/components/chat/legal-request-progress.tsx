"use client";

// ============================================================
// LEGALIR — LegalRequestProgress
// ============================================================
// The in-flight processing line that sits directly under the user's message.
// It is a single quiet line, not a card: a spinner, the current stage in plain
// Persian, and — only while streaming — a stop button. Expanding it reveals
// the real step list.
//
// Every value comes from the backend run (live SSE events while running, the
// persisted run after a refresh). The component never advances a step on a
// timer and never invents a percentage or a remaining time. Only operational
// statuses are shown — never the model's private reasoning (§5).
//
// States it renders:
//   running   — «لیگالیر — در حال …» + expandable steps + stop
//   waiting   — the questions the backend is waiting for + a note
//   completed — «بررسی درخواست تکمیل شد» + expandable steps
//   failed    — a user-safe message + a real retry (only when retryable)
//   cancelled — «بررسی متوقف شد»
// ============================================================

import { useState } from "react";
import { Button } from "@legalir/ui";
import type {
  ProcessingRunView,
  ProcessingStageView,
  StageStatus,
} from "@legalir/types";
import { STAGE_CONFIG } from "@/lib/ai/pipeline/stages";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconCheck,
  IconRefresh,
  IconStop,
  IconWarning,
  IconChevronDown,
  IconInfo,
} from "@/lib/icons";

export interface LegalRequestProgressProps {
  /** The run to render — live or restored from the backend. */
  run: ProcessingRunView;
  /** True while the SSE stream is still open. */
  isStreaming?: boolean;
  /** Stop the in-flight run (only offered while streaming). */
  onCancel?: () => void;
  /** Retry a failed run (only offered when the run is retryable). */
  onRetry?: () => void;
  /** Tighter layout for narrow viewports. */
  compact?: boolean;
}

/** Icon + colour for a step status. Status is never conveyed by colour alone. */
function StepMarker({ status }: { status: StageStatus }) {
  const base =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-caption";
  switch (status) {
    case "COMPLETED":
      return (
        <span className={`${base} border-primary bg-primary text-primary-on`} aria-hidden="true">
          <IconCheck size={12} />
        </span>
      );
    case "SKIPPED":
      return (
        <span className={`${base} border-outline text-muted`} aria-hidden="true">
          <IconCheck size={12} />
        </span>
      );
    case "ACTIVE":
      return (
        <span className={`${base} border-primary text-primary`} aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
        </span>
      );
    case "WAITING":
      return (
        <span className={`${base} border-warning text-warning`} aria-hidden="true">
          <IconInfo size={12} />
        </span>
      );
    case "FAILED":
      return (
        <span className={`${base} border-error text-error`} aria-hidden="true">
          <IconWarning size={12} />
        </span>
      );
    default:
      return (
        <span className={`${base} border-outline-variant text-muted`} aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
        </span>
      );
  }
}

/** The user-facing label for a step, given its status. */
function stepLabel(step: ProcessingStageView): string {
  const cfg = STAGE_CONFIG[step.stage];
  switch (step.status) {
    case "ACTIVE":
      return cfg.description;
    case "COMPLETED":
      return cfg.label;
    case "SKIPPED":
      return `${cfg.label} — برای این درخواست لازم نبود`;
    case "WAITING":
      return `${cfg.label} — منتظر پاسخ شما`;
    case "FAILED":
      return `${cfg.label} — با مشکل مواجه شد`;
    default:
      return cfg.label;
  }
}

export function LegalRequestProgress({
  run,
  isStreaming = false,
  onCancel,
  onRetry,
  compact = false,
}: LegalRequestProgressProps) {
  const [expanded, setExpanded] = useState(false);

  const isFailed = run.status === "failed";
  const isWaiting = run.status === "waiting";
  const isCompleted = run.status === "completed";
  const isCancelled = run.status === "cancelled";
  const isActive = !isFailed && !isWaiting && !isCompleted && !isCancelled;

  const activeStep = run.steps.find((s) => s.status === "ACTIVE");
  const completedCount = run.steps.filter(
    (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
  ).length;

  // --- The single inline line --------------------------------------------
  let caption: string;
  if (isFailed) {
    caption = run.errorMessage ?? "در پردازش درخواست مشکلی ایجاد شد.";
  } else if (isWaiting) {
    caption = "برای ادامه به اطلاعات بیشتری نیاز داریم";
  } else if (isCompleted) {
    caption = `بررسی درخواست تکمیل شد — ${toPersianNumber(completedCount)} مرحله`;
  } else if (isCancelled) {
    caption = "بررسی درخواست متوقف شد";
  } else {
    caption = activeStep
      ? `لیگالیر — ${STAGE_CONFIG[activeStep.stage].description}`
      : "لیگالیر در حال آماده‌سازی پاسخ است…";
  }

  const canExpand = run.steps.length > 0;

  return (
    <div
      className={compact ? "mt-1.5" : "mt-2"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* One quiet line: marker → caption → actions/toggle */}
      <div className="flex items-center gap-2 text-bodySmall">
        {isFailed ? (
          <IconWarning size={14} className="shrink-0 text-error" aria-hidden="true" />
        ) : isWaiting ? (
          <IconInfo size={14} className="shrink-0 text-warning" aria-hidden="true" />
        ) : isCompleted ? (
          <IconCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
        ) : isCancelled ? (
          <IconStop size={14} className="shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <span
            className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}

        <span
          className={[
            "min-w-0 flex-1 truncate",
            isFailed ? "text-error" : isWaiting ? "text-warning" : "text-muted",
          ].join(" ")}
        >
          {caption}
        </span>

        {/* Real sources retrieved — only when the backend reported some (§7). */}
        {isActive && run.sourcesUsed > 0 && (
          <span className="shrink-0 text-caption text-muted">
            {toPersianNumber(run.sourcesUsed)} منبع
          </span>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
            aria-label={expanded ? "پنهان کردن مراحل" : "نمایش مراحل"}
          >
            <IconChevronDown
              size={14}
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </button>
        )}

        {isStreaming && onCancel && (
          <Button
            type="button"
            variant="danger-outlined"
            size="small"
            onClick={onCancel}
            startIcon={<IconStop size={13} />}
            className="h-7 shrink-0 !px-2 text-caption"
          >
            توقف
          </Button>
        )}

        {isFailed && run.retryable && onRetry && (
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={onRetry}
            startIcon={<IconRefresh size={13} />}
            className="h-7 shrink-0 !px-2 text-caption"
          >
            تلاش مجدد
          </Button>
        )}
      </div>

      {/* Waiting-for-user questions — the backend's real pending questions. */}
      {isWaiting && run.pendingQuestions.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-medium bg-warning-container p-3">
          {run.pendingQuestions.map((q, i) => (
            <li key={i} className="flex gap-2 text-bodySmall text-onSurface">
              <span className="text-warning" aria-hidden="true">
                {toPersianNumber(i + 1)}.
              </span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The real step timeline, revealed on demand. */}
      {expanded && canExpand && (
        <ol className="mt-2 ms-1 space-y-2 border-s border-divider ps-3">
          {run.steps.map((step) => {
            const isStepActive = step.status === "ACTIVE";
            const isDone = step.status === "COMPLETED" || step.status === "SKIPPED";
            return (
              <li key={step.stage} className="flex items-start gap-2.5">
                <StepMarker status={step.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-bodySmall",
                      isDone
                        ? "text-onSurfaceVariant"
                        : isStepActive
                          ? "font-medium text-primary"
                          : step.status === "FAILED"
                            ? "text-error"
                            : step.status === "WAITING"
                              ? "font-medium text-warning"
                              : "text-muted",
                    ].join(" ")}
                  >
                    {stepLabel(step)}
                  </p>
                  {isStepActive && (
                    <p className="mt-0.5 text-caption text-muted">
                      {STAGE_CONFIG[step.stage].description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
