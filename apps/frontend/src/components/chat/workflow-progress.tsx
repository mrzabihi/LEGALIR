"use client";

import { useMemo } from "react";

// ============================================================
// WorkflowProgress — visual phase indicator for the AI workflow
// Called by ConversationWorkspace (chat page) to show the
// current workflow phase, progress bar, domain, and pending
// questions. Receives data from the SSE "workflow" event.
// ============================================================

export type WorkflowPhase =
  | "DISCOVERY"
  | "DATA_COLLECTION"
  | "ANALYSIS"
  | "RECOMMENDATION"
  | "ACTION";

export interface WorkflowProgressProps {
  phase: WorkflowPhase;
  domain: string | null;
  intent: string | null;
  phaseChanged: boolean;
  pendingQuestions: string[];
  suggestCaseCreation: boolean;
  onCreateCase?: () => void;
}

const PHASES: { key: WorkflowPhase; label: string; step: number }[] = [
  { key: "DISCOVERY", label: "شناسایی", step: 1 },
  { key: "DATA_COLLECTION", label: "جمع‌آوری اطلاعات", step: 2 },
  { key: "ANALYSIS", label: "تحلیل حقوقی", step: 3 },
  { key: "RECOMMENDATION", label: "توصیه‌ها", step: 4 },
  { key: "ACTION", label: "اقدام", step: 5 },
];

const DOMAIN_LABELS: Record<string, string> = {
  family: "خانواده",
  contract: "قرارداد",
  property: "املاک",
  employment: "کار و استخدام",
  business: "تجارت و شرکت‌ها",
  criminal: "کیفری",
  financial: "مالی و بانکی",
  tax: "مالیات",
  other: "سایر",
};

export function WorkflowProgress({
  phase,
  domain,
  intent,
  phaseChanged,
  pendingQuestions,
  suggestCaseCreation,
  onCreateCase,
}: WorkflowProgressProps) {
  const currentStep = PHASES.find((p) => p.key === phase)?.step ?? 1;

  const domainLabel = domain ? DOMAIN_LABELS[domain] ?? domain : null;

  const phaseLabel = useMemo(() => {
    const p = PHASES.find((p) => p.key === phase);
    return p ? `مرحله ${p.step}/۵: ${p.label}` : phase;
  }, [phase]);

  return (
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 animate-fade-in"
      role="status"
      aria-label={`وضعیت فرایند: ${phaseLabel}`}
    >
      {/* Phase label + domain */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-labelSmall text-primary font-medium">
          {phaseLabel}
        </span>
        {domainLabel && (
          <span className="text-labelSmall text-onSurfaceVariant bg-surfaceVariant rounded-full px-2 py-0.5">
            {domainLabel}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1" aria-hidden="true">
        {PHASES.map((p) => (
          <div
            key={p.key}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              p.step <= currentStep
                ? "bg-primary"
                : "bg-surfaceVariant"
            }`}
          />
        ))}
      </div>

      {/* Phase changed animation hint */}
      {phaseChanged && (
        <p className="text-caption text-primary/70 animate-pulse">
          {phase === "DATA_COLLECTION" && "در حال جمع‌آوری اطلاعات تکمیلی..."}
          {phase === "ANALYSIS" && "در حال تحلیل حقوقی موضوع..."}
          {phase === "RECOMMENDATION" && "در حال ارائه توصیه‌های عملی..."}
          {phase === "ACTION" && "آماده اقدام — می‌توانید پرونده ایجاد کنید"}
        </p>
      )}

      {/* Pending questions hint */}
      {pendingQuestions.length > 0 && (
        <div className="text-caption text-muted">
          <span className="font-medium">سوالات در انتظار: </span>
          {pendingQuestions.slice(0, 2).map((q, i) => (
            <span key={i} className="block truncate">
              {i + 1}. {q}
            </span>
          ))}
          {pendingQuestions.length > 2 && (
            <span className="text-primary/70">
              +{pendingQuestions.length - 2} سوال دیگر
            </span>
          )}
        </div>
      )}

      {/* Create case CTA in ACTION phase */}
      {suggestCaseCreation && onCreateCase && (
        <button
          onClick={onCreateCase}
          className="w-full mt-2 rounded-lg bg-primary text-white px-4 py-2 text-button font-medium hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          ایجاد پرونده حقوقی
        </button>
      )}
    </div>
  );
}