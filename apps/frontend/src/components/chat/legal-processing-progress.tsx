"use client";

// ============================================================
// LEGALIR — LegalProcessingProgress
// ============================================================
// The segmented circular indicator for the Legal Intelligence Pipeline.
// Five arc segments, one per stage; the centre shows «N / ۵» and the
// current stage title. It is a pure view: every value comes from backend
// pipeline events, so it can never show progress the backend did not make.
//
// Independent of chat business logic — it takes stage statuses as props.
// ============================================================

import { useMemo, useState } from "react";
import { PROCESSING_STAGES, type ProcessingStage, type StageStatus } from "@legalir/types";
import { STAGE_CONFIG, STAGE_ORDER, TOTAL_STAGES } from "@/lib/ai/pipeline/stages";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCheck, IconRefresh, IconStop, IconWarning, IconChevronDown } from "@/lib/icons";

export interface LegalProcessingProgressProps {
  /** Status of every stage in the current run. */
  stages: Record<ProcessingStage, StageStatus>;
  /** The stage the pipeline is currently on. */
  currentStage: ProcessingStage;
  /** Set when a stage failed — switches the component to its error state. */
  error?: { stage: ProcessingStage; message: string; retryable: boolean } | null;
  /** Number of sources actually retrieved (shown only when > 0). */
  sourcesUsed?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  /** Tighter layout for narrow viewports. */
  compact?: boolean;
}

// --- Geometry -------------------------------------------------------------
const SIZE = 96;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Small gap between segments so the ring reads as five distinct arcs. */
const GAP = 6;
const SEGMENT_LENGTH = CIRCUMFERENCE / TOTAL_STAGES - GAP;

/** Colour per stage status, using the MD3 token palette. */
function segmentClass(status: StageStatus): string {
  switch (status) {
    case "COMPLETED":
    case "SKIPPED":
    case "ACTIVE":
      return "stroke-primary";
    case "WAITING":
      return "stroke-amber-500";
    case "FAILED":
      return "stroke-error";
    default:
      return "stroke-outline/25";
  }
}

export function LegalProcessingProgress({
  stages,
  currentStage,
  error = null,
  sourcesUsed = 0,
  onRetry,
  onCancel,
  compact = false,
}: LegalProcessingProgressProps) {
  const [expanded, setExpanded] = useState(false);

  const currentConfig = STAGE_CONFIG[currentStage];
  const currentStatus = stages[currentStage];

  // The counter shows the stage being worked on, not the count of finished
  // ones, so it reads «۳ / ۵» while Stage 3 is running.
  const displayNumber = error
    ? STAGE_CONFIG[error.stage].order
    : Math.min(currentConfig.order, TOTAL_STAGES);

  const isFailed = error !== null;
  const isWaiting = currentStatus === "WAITING";

  const headline = isFailed
    ? `${STAGE_CONFIG[error.stage].label} با مشکل مواجه شد`
    : currentConfig.label;

  const subline = isFailed
    ? error.message
    : isWaiting
      ? "برای ادامه به اطلاعات بیشتری نیاز است"
      : currentConfig.description;

  return (
    <div
      className={[
        "rounded-large border bg-surface p-4",
        isFailed ? "border-error/30" : "border-divider",
        compact ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-4",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Segmented circular indicator */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {PROCESSING_STAGES.map((stage, i) => {
            const status = stages[stage];
            const isActive = stage === currentStage && !isFailed;
            return (
              <circle
                key={stage}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${SEGMENT_LENGTH} ${CIRCUMFERENCE - SEGMENT_LENGTH}`}
                strokeDashoffset={-(i * (CIRCUMFERENCE / TOTAL_STAGES))}
                className={[
                  segmentClass(status),
                  "transition-[stroke] duration-300",
                  isActive ? "animate-pulse" : "",
                ].join(" ")}
              />
            );
          })}
        </svg>

        {/* Centre counter */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-titleMedium font-semibold text-onSurface tabular-nums">
            {toPersianNumber(displayNumber)} / {toPersianNumber(TOTAL_STAGES)}
          </span>
          <span className="mt-0.5 max-w-[72px] truncate text-caption text-muted">
            {isFailed ? STAGE_CONFIG[error.stage].label : currentConfig.label}
          </span>
        </div>
      </div>

      {/* Stage title + description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isFailed ? (
            <IconWarning size={16} className="shrink-0 text-error" />
          ) : isWaiting ? (
            <IconWarning size={16} className="shrink-0 text-amber-500" />
          ) : null}
          <p
            className={[
              "truncate text-bodyMedium font-medium",
              isFailed ? "text-error" : "text-onSurface",
            ].join(" ")}
          >
            {headline}
          </p>
        </div>
        <p className="mt-0.5 text-bodySmall text-muted">{subline}</p>

        {/* Only claim sources when retrieval actually returned some. */}
        {!isFailed && sourcesUsed > 0 && (
          <p className="mt-1 text-caption text-primary-700">
            پاسخ با بررسی {toPersianNumber(sourcesUsed)} منبع حقوقی
          </p>
        )}

        {/* Actions */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-caption font-medium text-white transition hover:bg-primary-700"
            >
              <IconRefresh size={14} />
              تلاش مجدد
            </button>
          )}
          {!isFailed && onCancel && (
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
            مشاهده مراحل
            <IconChevronDown
              size={14}
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </button>
        </div>
      </div>

      {/* Optional expanded stepper */}
      {expanded && (
        <ol className="w-full basis-full space-y-1.5 border-t border-divider pt-3">
          {STAGE_ORDER.map((cfg) => {
            const status = stages[cfg.stage];
            const done = status === "COMPLETED" || status === "SKIPPED";
            const active = cfg.stage === currentStage && !isFailed;
            const failed = status === "FAILED";
            return (
              <li key={cfg.stage} className="flex items-center gap-2 text-bodySmall">
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-caption",
                    done
                      ? "border-primary bg-primary text-white"
                      : failed
                        ? "border-error text-error"
                        : active
                          ? "border-primary text-primary"
                          : "border-outline/40 text-muted",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {done ? <IconCheck size={12} /> : active ? "●" : "○"}
                </span>
                <span
                  className={[
                    done ? "text-onSurface" : active ? "text-primary font-medium" : "text-muted",
                  ].join(" ")}
                >
                  {cfg.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
