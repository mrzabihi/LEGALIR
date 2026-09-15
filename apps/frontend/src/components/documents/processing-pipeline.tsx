// ============================================================
// LEGALIR — Document Processing Pipeline
// Animated step-by-step visualization of the analysis stages
// ============================================================

"use client";

import React from "react";
import { IconUpload, IconDocument, IconSearch, IconShield, IconCheck } from "@/lib/icons";

export type PipelineStage = "upload" | "extract" | "analyze" | "ready";

interface StageDef {
  key: PipelineStage;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const STAGES: StageDef[] = [
  {
    key: "upload",
    label: "بارگذاری",
    description: "فایل شما با امنیت کامل بارگذاری شد",
    icon: <IconUpload size={22} />,
  },
  {
    key: "extract",
    label: "استخراج متن",
    description: "متن و بندهای سند استخراج می‌شود",
    icon: <IconDocument size={22} />,
  },
  {
    key: "analyze",
    label: "تحلیل حقوقی",
    description: "ریسک‌ها و بندهای مهم بررسی می‌شود",
    icon: <IconSearch size={22} />,
  },
  {
    key: "ready",
    label: "آماده",
    description: "گزارش تحلیل شما آماده است",
    icon: <IconShield size={22} />,
  },
];

const STAGE_INDEX: Record<PipelineStage, number> = {
  upload: 0,
  extract: 1,
  analyze: 2,
  ready: 3,
};

interface ProcessingPipelineProps {
  /** Current active stage */
  stage: PipelineStage;
  /** Progress 0-100 for the active stage */
  progress?: number;
}

export function ProcessingPipeline({ stage, progress = 0 }: ProcessingPipelineProps) {
  const activeIndex = STAGE_INDEX[stage];

  return (
    <div className="w-full" dir="rtl">
      {/* Stepper */}
      <ol className="flex items-center">
        {STAGES.map((s, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          const isLast = i === STAGES.length - 1;

          return (
            <React.Fragment key={s.key}>
              {/* Node */}
              <li className="flex flex-col items-center shrink-0">
                <div
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isDone
                      ? "border-success bg-success text-white"
                      : isActive
                        ? "border-primary bg-primary text-white shadow-elevation-3"
                        : "border-divider bg-surface text-muted",
                  ].join(" ")}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? <IconCheck size={20} /> : s.icon}
                </div>
                <span
                  className={[
                    "mt-2 text-caption font-medium",
                    isActive ? "text-primary" : isDone ? "text-success" : "text-muted",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </li>

              {/* Connector */}
              {!isLast && (
                <li
                  className={[
                    "h-0.5 flex-1 mx-2 mb-6 rounded-full transition-colors duration-300",
                    i < activeIndex ? "bg-success" : "bg-divider",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Active stage detail */}
      <div className="mt-6 rounded-large border border-divider/60 bg-surface p-5 shadow-elevation-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-50 text-primary-700">
            {STAGES[activeIndex]?.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-titleMedium text-on-surface">
              {STAGES[activeIndex]?.label}
            </p>
            <p className="text-caption text-muted mt-0.5">
              {STAGES[activeIndex]?.description}
            </p>
          </div>
          {stage !== "ready" && (
            <span className="shrink-0 text-caption font-medium text-primary">
              {Math.round(progress)}٪
            </span>
          )}
        </div>

        {/* Progress bar */}
        {stage !== "ready" && (
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-standard"
              style={{ width: `${Math.max(8, progress)}%` }}
            />
          </div>
        )}

        {/* Ready check */}
        {stage === "ready" && (
          <div className="mt-4 flex items-center gap-2 text-caption text-success">
            <IconCheck size={16} />
            تحلیل سند با موفقیت تکمیل شد
          </div>
        )}
      </div>
    </div>
  );
}
