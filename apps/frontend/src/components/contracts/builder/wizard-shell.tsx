// ============================================================
// LEGALIR — Contract Builder wizard shell
// ============================================================
// The frame around every step: a progress header driven by REAL
// field completeness, a step rail, the active step body, and a
// sticky footer with back/next. The shell knows nothing about any
// specific contract type — it reads the step list from the registry
// and renders whatever the step registry maps to.
// ============================================================

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Button, ProgressLinear } from "@legalir/ui";
import { IconArrowBack, IconArrowForward, IconCheck, IconRefresh } from "@/lib/icons";
import { useWizard, WizardProvider } from "./wizard-context";
import { STEP_COMPONENTS } from "./steps";
import type { ContractCompleteness, PropertyContractDetail } from "@legalir/types";
import { getContractDefinition } from "@/lib/contracts/registry";

// ------------------------------------------------------------
// Save indicator
// ------------------------------------------------------------

function SaveIndicator() {
  const { saveStatus, lastSavedAt, saveNow } = useWizard();

  if (saveStatus === "saving") {
    return <span className="text-caption text-muted">در حال ذخیره…</span>;
  }
  if (saveStatus === "error") {
    return (
      <button
        type="button"
        onClick={() => void saveNow()}
        className="text-caption text-error inline-flex items-center gap-1 hover:underline"
      >
        <IconRefresh className="w-3.5 h-3.5" />
        ذخیره نشد — تلاش دوباره
      </button>
    );
  }
  if (saveStatus === "saved" && lastSavedAt) {
    return (
      <span className="text-caption text-success inline-flex items-center gap-1">
        <IconCheck className="w-3.5 h-3.5" />
        ذخیره شد
      </span>
    );
  }
  return <span className="text-caption text-muted">ذخیره خودکار فعال است</span>;
}

// ------------------------------------------------------------
// Step rail
// ------------------------------------------------------------

function StepRail() {
  const { contract, stepId, stepIndex, goToStep, completeness } = useWizard();
  const def = useMemo(() => getContractDefinition(contract.type), [contract.type]);

  /** A step is "done" when every section it owns is complete. */
  const stepDone = (id: string): boolean => {
    const step = def.wizardSteps.find((s) => s.id === id);
    if (!step || step.sections.length === 0) return false;
    return step.sections.every((key) => {
      const section = completeness.sections.find((s) => s.key === key);
      return section ? section.percent === 100 : false;
    });
  };

  return (
    <nav aria-label="مراحل قرارداد" className="space-y-1">
      {def.wizardSteps.map((step, i) => {
        const active = step.id === stepId;
        const done = stepDone(step.id);
        const reachable = i <= stepIndex || done;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => reachable && goToStep(step.id)}
            disabled={!reachable}
            aria-current={active ? "step" : undefined}
            className={`w-full text-right rounded-medium px-3 py-2.5 flex items-start gap-3 transition-colors ${
              active
                ? "bg-primary-container text-primary-on-container"
                : reachable
                  ? "hover:bg-surface-container text-on-surface"
                  : "text-muted cursor-not-allowed"
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-labelSmall ${
                done
                  ? "bg-success text-on-success"
                  : active
                    ? "bg-primary text-primary-on"
                    : "bg-surface-container-high text-muted"
              }`}
            >
              {done ? <IconCheck className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-body-2">{step.titleFa}</span>
              <span className="block text-caption text-muted truncate">{step.descriptionFa}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------
// Body
// ------------------------------------------------------------

function WizardBody() {
  const {
    contract,
    stepId,
    stepIndex,
    stepCount,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
    progress,
    completeness,
    editable,
  } = useWizard();
  const def = useMemo(() => getContractDefinition(contract.type), [contract.type]);
  const step = def.wizardSteps.find((s) => s.id === stepId) ?? def.wizardSteps[0]!;
  const StepComponent = STEP_COMPONENTS[step.id];

  const blockers = completeness.blockers;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-divider">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <Link
                href="/contracts"
                className="text-caption text-muted hover:text-on-surface inline-flex items-center gap-1"
              >
                <IconArrowForward className="w-3.5 h-3.5" />
                بازگشت به مرکز قراردادها
              </Link>
              <h1 className="text-h4 text-on-surface truncate mt-0.5">{contract.title}</h1>
              <p className="text-caption text-muted">
                {contract.referenceCode} — {def.typeFa}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator />
            </div>
          </div>

          {/* Progress — real completeness, not step count */}
          <div className="mt-3">
            <ProgressLinear
              value={progress}
              label={`پیشرفت تکمیل: ${progress}٪`}
              showValue
              color={progress === 100 ? "success" : "primary"}
            />
            {blockers.length > 0 && (
              <p className="text-caption text-muted mt-1">
                {blockers.length} بخش نیازمند تکمیل: {blockers.map((b) => b.labelFa).join("، ")}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-1 desktop:grid-cols-[260px_1fr] gap-5">
        {/* Rail — desktop only */}
        <aside className="hidden desktop:block">
          <div className="sticky top-32 rounded-large bg-surface border border-divider p-2">
            <StepRail />
          </div>
        </aside>

        {/* Step body */}
        <main className="min-w-0 space-y-4 pb-28 desktop:pb-6">
          <div>
            <p className="text-caption text-muted">
              مرحله {stepIndex + 1} از {stepCount}
            </p>
            <h2 className="text-h3 text-on-surface">{step.titleFa}</h2>
            <p className="text-body-2 text-muted mt-0.5">{step.descriptionFa}</p>
          </div>

          {!editable && (
            <div className="rounded-medium border border-warning/40 bg-warning-50 px-3 py-2.5 text-body-2">
              این قرارداد در وضعیت فعلی قابل ویرایش نیست. برای تغییر محتوا ابتدا از طرف مقابل درخواست اصلاح کنید.
            </div>
          )}

          {StepComponent ? (
            <StepComponent />
          ) : (
            <div className="rounded-large border border-divider bg-surface p-6 text-body-2 text-muted">
              این مرحله هنوز پیاده‌سازی نشده است.
            </div>
          )}
        </main>
      </div>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-divider desktop:static desktop:bg-transparent desktop:border-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="outlined"
            onClick={goPrev}
            disabled={!canGoPrev}
            startIcon={<IconArrowForward className="w-4 h-4" />}
          >
            مرحله قبل
          </Button>
          <Button
            onClick={goNext}
            disabled={!canGoNext}
            endIcon={<IconArrowBack className="w-4 h-4" />}
          >
            {canGoNext ? "مرحله بعد" : "پایان مراحل"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Public
// ------------------------------------------------------------

export function ContractBuilder({
  contract,
  completeness,
}: {
  contract: PropertyContractDetail;
  completeness: ContractCompleteness;
}) {
  return (
    <WizardProvider contract={contract} completeness={completeness}>
      <WizardBody />
    </WizardProvider>
  );
}
