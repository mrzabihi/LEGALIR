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
import { Button, snackbar } from "@legalir/ui";
import { IconArrowBack, IconArrowForward, IconCheck } from "@/lib/icons";
import { useWizard, WizardProvider } from "./wizard-context";
import { stepComponentFor } from "./steps";
import { ContractWorkspaceHeader } from "./contract-workspace-header";
import type { ContractCompleteness, PropertyContractDetail } from "@legalir/types";
import { PROPERTY_CONTRACT_STATE_LABELS } from "@legalir/types";
import { getContractDefinition } from "@/lib/contracts/registry";

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
    state,
    saveStatus,
    lastSavedAt,
    saveNow,
  } = useWizard();
  const def = useMemo(() => getContractDefinition(contract.type), [contract.type]);
  const step = def.wizardSteps.find((s) => s.id === stepId) ?? def.wizardSteps[0]!;
  const StepComponent = stepComponentFor(contract.type, step.id);

  const handleCopyId = () => {
    void navigator.clipboard?.writeText(contract.referenceCode).then(
      () => snackbar.show({ message: "شناسه قرارداد کپی شد.", variant: "success" }),
      () => snackbar.show({ message: "کپی شناسه انجام نشد.", variant: "error" })
    );
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <ContractWorkspaceHeader
        title={contract.title}
        referenceCode={contract.referenceCode}
        typeFa={def.typeFa}
        stateFa={PROPERTY_CONTRACT_STATE_LABELS[state] ?? ""}
        progress={progress}
        sections={completeness.sections}
        blockers={completeness.blockers}
        stepIndex={stepIndex}
        stepCount={stepCount}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onRetrySave={() => void saveNow()}
        onCopyId={handleCopyId}
      />

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
      <div className="fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-divider desktop:static desktop:bg-transparent desktop:border-0">
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
