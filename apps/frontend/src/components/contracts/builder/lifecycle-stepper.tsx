// ============================================================
// LEGALIR — Lifecycle stepper
// ============================================================
// The five-stage progress rail shown above the lifecycle workspace:
//
//   اطلاعات ✓ → پیش‌نمایش ✓ → بررسی ● → امضا ○ → تکمیل ○
//
// It is purely presentational: the stage, the status of each step and
// whether a step is reachable all come from the server's lifecycle
// view. The stepper never decides what is allowed — it only draws it.
// ============================================================

"use client";

import React from "react";
import type { LifecycleStepView } from "@legalir/types";
import { IconCheck } from "@/lib/icons";

interface LifecycleStepperProps {
  steps: LifecycleStepView[];
  /** Called when a reachable step is clicked. */
  onSelect?: (step: LifecycleStepView) => void;
}

export function LifecycleStepper({ steps, onSelect }: LifecycleStepperProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="مراحل قرارداد">
      {steps.map((step, index) => {
        const isDone = step.status === "done";
        const isActive = step.status === "active";
        const clickable = step.reachable && !!onSelect;

        return (
          <li key={step.stage} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={clickable ? () => onSelect?.(step) : undefined}
              disabled={!clickable}
              aria-current={isActive ? "step" : undefined}
              className={[
                "inline-flex items-center gap-2 rounded-full h-9 px-3 text-labelLarge transition-colors",
                isDone
                  ? "bg-primary-container text-on-primary-container"
                  : isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-muted",
                clickable ? "cursor-pointer hover:state-hover" : "cursor-default",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex items-center justify-center w-5 h-5 rounded-full text-caption",
                  isDone
                    ? "bg-primary text-on-primary"
                    : isActive
                      ? "bg-on-primary text-primary"
                      : "bg-surface text-muted",
                ].join(" ")}
              >
                {isDone ? <IconCheck className="w-3.5 h-3.5" /> : index + 1}
              </span>
              <span>{step.labelFa}</span>
            </button>

            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={[
                  "w-4 h-px",
                  isDone ? "bg-primary" : "bg-divider",
                ].join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
