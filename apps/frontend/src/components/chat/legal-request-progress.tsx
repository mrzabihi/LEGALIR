"use client";

// ============================================================
// LEGALIR — LegalRequestProgress
// ============================================================
// The in-conversation progress timeline for a legal request. It is a
// timeline entry, not an overlay: it stays in the conversation after the
// run finishes, collapsing to a one-line summary the user can expand.
//
// Every value comes from the backend run (live SSE events while running,
// the persisted run after a refresh). The component never advances a step
// on a timer and never invents a percentage or a remaining time.
//
// States it renders (§14, §15, §18, §40):
//   running   — steps with PENDING / ACTIVE / COMPLETED / SKIPPED
//   waiting   — a step is WAITING_FOR_USER; shows the questions + a CTA
//   completed — collapses to «بررسی درخواست تکمیل شد» + expandable steps
//   failed    — the failed step, a user-safe message, and a real retry
// ============================================================

import { useState } from "react";
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
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-caption";
  switch (status) {
    case "COMPLETED":
      return (
        <span className={`${base} border-primary bg-primary text-white`} aria-hidden="true">
          <IconCheck size={13} />
        </span>
      );
    case "SKIPPED":
      return (
        <span className={`${base} border-outline/40 text-muted`} aria-hidden="true">
          <IconCheck size={13} />
        </span>
      );
    case "ACTIVE":
      return (
        <span className={`${base} border-primary text-primary`} aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
        </span>
      );
    case "WAITING":
      return (
        <span className={`${base} border-amber-500 text-amber-600`} aria-hidden="true">
          <IconInfo size={13} />
        </span>
      );
    case "FAILED":
      return (
        <span className={`${base} border-error text-error`} aria-hidden="true">
          <IconWarning size={13} />
        </span>
      );
    default:
      return (
        <span className={`${base} border-outline/40 text-muted`} aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-outline/50" />
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

  const completedCount = run.steps.filter(
    (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
  ).length;

  // --- Headline + subline -------------------------------------------------
  let headline: string;
  let subline: string;
  if (isFailed) {
    headline = "بررسی درخواست متوقف شد";
    subline = run.errorMessage ?? "در پردازش درخواست مشکلی ایجاد شد.";
  } else if (isWaiting) {
    headline = "برای ادامه به اطلاعات بیشتری نیاز داریم";
    subline = "پس از پاسخ شما، بررسی ادامه پیدا می‌کند.";
  } else if (isCompleted) {
    headline = "بررسی درخواست تکمیل شد";
    subline = `${toPersianNumber(completedCount)} مرحله انجام شد`;
  } else if (isCancelled) {
    headline = "بررسی درخواست متوقف شد";
    subline = "این بررسی نیمه‌کاره ماند.";
  } else {
    const active = run.steps.find((s) => s.status === "ACTIVE");
    headline = "در حال بررسی درخواست شما";
    subline = active ? STAGE_CONFIG[active.stage].description : "در حال آماده‌سازی…";
  }

  // The collapsed summary is a single line; the full step list is behind
  // «مشاهده مراحل» so a finished run never crowds the conversation (§18, §55).
  const showSummaryOnly = isCompleted || isCancelled;

  return (
    <div
      className={[
        "rounded-large border bg-surface",
        isFailed ? "border-error/30" : isWaiting ? "border-amber-500/40" : "border-divider",
        compact ? "p-3" : "p-4",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isFailed
              ? "bg-error/10 text-error"
              : isWaiting
                ? "bg-amber-500/10 text-amber-600"
                : "bg-primary/10 text-primary",
          ].join(" ")}
          aria-hidden="true"
        >
          {isFailed ? (
            <IconWarning size={16} />
          ) : isWaiting ? (
            <IconInfo size={16} />
          ) : isCompleted ? (
            <IconCheck size={16} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={[
              "text-bodyMedium font-medium",
              isFailed ? "text-error" : "text-onSurface",
            ].join(" ")}
          >
            {headline}
          </p>
          <p className="mt-0.5 text-bodySmall text-muted">{subline}</p>

          {/* Sources — only when retrieval actually returned some (§47). */}
          {!isFailed && run.sourcesUsed > 0 && (
            <p className="mt-1 text-caption text-primary-700">
              پاسخ با بررسی {toPersianNumber(run.sourcesUsed)} منبع حقوقی
            </p>
          )}
        </div>
      </div>

      {/* Waiting-for-user questions (§16, §17) */}
      {isWaiting && run.pendingQuestions.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-medium bg-amber-500/[0.06] p-3">
          {run.pendingQuestions.map((q, i) => (
            <li key={i} className="flex gap-2 text-bodySmall text-onSurface">
              <span className="text-amber-600" aria-hidden="true">
                {toPersianNumber(i + 1)}.
              </span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isFailed && run.retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-caption font-medium text-white transition hover:bg-primary-700"
          >
            <IconRefresh size={14} />
            تلاش مجدد
          </button>
        )}
        {isStreaming && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption text-muted transition hover:bg-error/10 hover:text-error"
          >
            <IconStop size={14} />
            توقف
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-caption text-muted transition hover:bg-onSurface/[0.06]"
        >
          {showSummaryOnly ? "مشاهده روند بررسی" : "مشاهده مراحل"}
          <IconChevronDown
            size={14}
            className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      </div>

      {/* Step timeline — hidden for a finished run until expanded. */}
      {(!showSummaryOnly || expanded) && (
        <ol className="mt-3 space-y-2 border-t border-divider pt-3">
          {run.steps.map((step) => {
            const cfg = STAGE_CONFIG[step.stage];
            const isActive = step.status === "ACTIVE";
            const isDone = step.status === "COMPLETED" || step.status === "SKIPPED";
            return (
              <li key={step.stage} className="flex items-start gap-2.5">
                <StepMarker status={step.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-bodySmall",
                      isDone
                        ? "text-onSurface"
                        : isActive
                          ? "font-medium text-primary"
                          : step.status === "FAILED"
                            ? "text-error"
                            : step.status === "WAITING"
                              ? "font-medium text-amber-700"
                              : "text-muted",
                    ].join(" ")}
                  >
                    {stepLabel(step)}
                  </p>
                  {/* The step's own description, shown only while it runs, so
                      the list stays calm when everything is done (§19). */}
                  {isActive && (
                    <p className="mt-0.5 text-caption text-muted">{cfg.description}</p>
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
