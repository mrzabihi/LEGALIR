// ============================================================
// LEGALIR — Contract sections summary
// ============================================================
// The one-glance answer to "what is still missing?" on the contract
// workspace: a row of section cards, each with a REAL status read from
// the server-computed completeness and a short reason naming the
// missing items.
//
// The status is never guessed from "did the user visit this step":
//
//   complete     every section the step owns is at 100%
//   in-progress  some data is entered, but required items remain
//   incomplete   nothing is filled yet
//   review       the final step — ready only when NO section blocks
//   stage        the signature stage — follows the confirmed supplement
//
// Each card jumps to the step that owns the section, so the summary is
// navigation as well as status (Spec A §6).
// ============================================================

"use client";

import React from "react";
import type { ContractCompletenessSection, WizardStepDescriptor } from "@legalir/types";
import { IconCheckCircle, IconClock, IconWarning } from "@/lib/icons";
import { toPersianDigits } from "@/lib/persian-utils";

export type SectionSummaryState =
  | "complete"
  | "in-progress"
  | "incomplete"
  | "review"
  | "stage";

export interface SectionSummaryItem {
  stepId: string;
  titleFa: string;
  state: SectionSummaryState;
  /** Mean of the sections this step owns; null for the review step. */
  percent: number | null;
  /** A short, user-facing reason — the missing item labels. */
  reasonFa: string | null;
}

/** Limit the reason so three missing fields do not wrap the whole card. */
function missingReasonFa(missing: string[]): string | null {
  if (missing.length === 0) return null;
  const shown = missing.slice(0, 2).join("، ");
  return missing.length > 2
    ? `${shown} و ${toPersianDigits(missing.length - 2)} مورد دیگر`
    : shown;
}

/**
 * Derive one status item per wizard step from the completeness the
 * server already computed. Pure, so it can be tested without a DOM.
 */
export function buildSectionSummary(
  steps: WizardStepDescriptor[],
  sections: ContractCompletenessSection[]
): SectionSummaryItem[] {
  const blockingSections = sections.filter((s) => s.percent < 100);

  return steps.map((step) => {
    // The review and signature steps own no data sections: their status
    // is derived from every other section. The signature stage is told
    // apart so its card can say what it is actually waiting for.
    if (step.sections.length === 0) {
      return {
        stepId: step.id,
        titleFa: step.titleFa,
        state: step.id === "signature" ? "stage" : "review",
        percent: null,
        reasonFa:
          blockingSections.length > 0
            ? `${toPersianDigits(blockingSections.length)} بخش هنوز تکمیل نشده است`
            : null,
      };
    }

    const owned = step.sections
      .map((key) => sections.find((s) => s.key === key))
      .filter((s): s is ContractCompletenessSection => Boolean(s));

    const percent =
      owned.length === 0
        ? 100
        : Math.round(owned.reduce((sum, s) => sum + s.percent, 0) / owned.length);
    const missing = owned.flatMap((s) => s.missing);

    return {
      stepId: step.id,
      titleFa: step.titleFa,
      state: percent === 100 ? "complete" : percent === 0 ? "incomplete" : "in-progress",
      percent,
      reasonFa: missingReasonFa(missing),
    };
  });
}

function statusLabelFa(item: SectionSummaryItem): string {
  switch (item.state) {
    case "complete":
      return "تکمیل شده";
    case "in-progress":
      return `${toPersianDigits(item.percent ?? 0)}٪ تکمیل`;
    case "incomplete":
      return "تکمیل نشده";
    case "review":
      return item.reasonFa ? "در انتظار تکمیل بخش‌ها" : "آمادهٔ بازبینی";
    case "stage":
      return item.reasonFa ? "در انتظار تکمیل بخش‌ها" : "پس از تأیید اطلاعات تکمیلی";
  }
}

const STATE_STYLES: Record<
  SectionSummaryState,
  { icon: React.ComponentType<{ className?: string }>; iconClass: string; card: string }
> = {
  complete: {
    icon: IconCheckCircle,
    iconClass: "text-success",
    card: "border-success/40 bg-success-container",
  },
  "in-progress": {
    icon: IconClock,
    iconClass: "text-warning",
    card: "border-warning/40 bg-warning-container",
  },
  incomplete: {
    icon: IconWarning,
    iconClass: "text-muted",
    card: "border-divider bg-surface",
  },
  review: {
    icon: IconClock,
    iconClass: "text-muted",
    card: "border-divider bg-surface",
  },
  stage: {
    icon: IconClock,
    iconClass: "text-muted",
    card: "border-divider bg-surface",
  },
};

export function SectionsSummary({
  items,
  currentStepId,
  onSelect,
}: {
  items: SectionSummaryItem[];
  currentStepId: string;
  onSelect: (stepId: string) => void;
}) {
  return (
    <section
      aria-label="وضعیت بخش‌های قرارداد"
      className="rounded-large border border-divider bg-surface p-2"
    >
      <div className="scrollbar-hide flex gap-2 overflow-x-auto desktop:flex-wrap desktop:overflow-visible">
        {items.map((item) => {
          const style = STATE_STYLES[item.state];
          const Icon = style.icon;
          const active = item.stepId === currentStepId;
          return (
            <button
              key={item.stepId}
              type="button"
              onClick={() => onSelect(item.stepId)}
              aria-current={active ? "true" : undefined}
              className={`min-w-[10.5rem] flex-1 basis-40 text-right rounded-medium border px-2.5 py-2 flex items-start gap-2 transition-colors ${
                style.card
              } ${
                active
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-surface"
                  : "hover:border-primary/50"
              }`}
            >
              <Icon className={`mt-0.5 w-4 h-4 shrink-0 ${style.iconClass}`} />
              <span className="min-w-0">
                <span className="block truncate text-labelMedium text-on-surface">
                  {item.titleFa}
                </span>
                <span className="block truncate text-caption text-muted">
                  {statusLabelFa(item)}
                </span>
                {item.state !== "complete" && item.reasonFa && (
                  <span className="mt-0.5 block truncate text-caption text-muted">
                    {item.reasonFa}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
