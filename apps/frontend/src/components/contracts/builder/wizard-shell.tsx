// ============================================================
// LEGALIR — Contract Builder wizard shell
// ============================================================
// The frame around every step: a progress header driven by REAL
// field completeness, the section status row (which is also the
// navigation surface), the active step body, and a sticky footer
// whose primary action follows the real status. The shell knows
// nothing about any specific contract type — it reads the step list
// from the registry and renders whatever the step registry maps to.
// ============================================================

"use client";

import React, { useMemo } from "react";
import { Button, snackbar } from "@legalir/ui";
import { IconArrowBack, IconArrowForward } from "@/lib/icons";
import { useWizard, WizardProvider } from "./wizard-context";
import { stepComponentFor } from "./steps";
import { ContractWorkspaceHeader } from "./contract-workspace-header";
import { buildSectionSummary, SectionsSummary } from "./sections-summary";
import type { ContractCompleteness, PropertyContractDetail } from "@legalir/types";
import { PROPERTY_CONTRACT_STATE_LABELS } from "@legalir/types";
import { getContractDefinition } from "@/lib/contracts/registry";

// ------------------------------------------------------------
// Body
// ------------------------------------------------------------

function WizardBody() {
  const {
    contract,
    stepId,
    stepIndex,
    stepCount,
    goToStep,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
    progress,
    completeness,
    editable,
    state,
    saveStatus,
    saveError,
    lastSavedAt,
    saveNow,
    advanceBlockedReason,
    clearAdvanceBlocked,
  } = useWizard();
  const def = useMemo(() => getContractDefinition(contract.type), [contract.type]);
  const step = def.wizardSteps.find((s) => s.id === stepId) ?? def.wizardSteps[0]!;
  const StepComponent = stepComponentFor(contract.type, step.id);

  // The summary row is the page's answer to "what is still missing?" —
  // built from the same server-computed completeness the header shows.
  const summaryItems = useMemo(
    () => buildSectionSummary(def.wizardSteps, completeness.sections),
    [def.wizardSteps, completeness.sections]
  );
  // Only data steps can be "the thing still missing". The summary row is
  // built from data-owning steps only, so every item here is a real
  // completion target.
  const firstOpenStep = summaryItems.find((item) => item.state !== "complete");

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
        saveError={saveError}
        lastSavedAt={lastSavedAt}
        onRetrySave={() => void saveNow()}
        onCopyId={handleCopyId}
      />

      {/* Section status, one row — the page's primary orientation aid.
          Selecting a card navigates to the step that owns it. */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <SectionsSummary
          items={summaryItems}
          currentStepId={stepId}
          onSelect={goToStep}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">
        {/* Step body. The section summary above is the single navigation
            surface — a duplicate desktop rail only split the user's
            attention between two lists of the same steps. */}
        <main className="min-w-0 space-y-4 pb-28 desktop:pb-6">
          <div>
            <p className="text-caption text-muted">
              مرحله {stepIndex + 1} از {stepCount}
            </p>
            <h2 className="text-h3 text-on-surface">{step.titleFa}</h2>
            <p className="text-body-2 text-muted mt-0.5">{step.descriptionFa}</p>
          </div>

          {!editable && (
            <div className="rounded-medium border border-warning bg-warning-container px-3 py-2.5 text-body-2">
              این قرارداد در وضعیت فعلی قابل ویرایش نیست. برای تغییر محتوا ابتدا از طرف مقابل درخواست اصلاح کنید.
            </div>
          )}

          {advanceBlockedReason && (
            <div
              role="alert"
              className="rounded-medium border border-error bg-error-container px-3 py-2.5 text-body-2 flex items-start justify-between gap-3"
            >
              <span>{advanceBlockedReason}</span>
              <button
                type="button"
                onClick={clearAdvanceBlocked}
                className="text-caption underline shrink-0"
              >
                بستن
              </button>
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
          {/* Icons are semantic (back / forward) and mirrored under RTL, so
              the arrow always points the way the step actually moves. */}
          <Button
            variant="outlined"
            onClick={goPrev}
            disabled={!canGoPrev}
            startIcon={<IconArrowBack className="h-4 w-4" />}
          >
            مرحله قبل
          </Button>
          {canGoNext ? (
            <Button onClick={goNext} endIcon={<IconArrowForward className="h-4 w-4" />}>
              مرحله بعد
            </Button>
          ) : (
            /* On the last step the primary action acts on the REAL status:
               it takes the user to the first section that still blocks
               readiness, and only reads as done when nothing blocks. */
            <Button
              onClick={() => firstOpenStep && goToStep(firstOpenStep.stepId)}
              disabled={!firstOpenStep}
              endIcon={
                firstOpenStep ? <IconArrowBack className="w-4 h-4" /> : undefined
              }
            >
              {firstOpenStep
                ? `تکمیل «${firstOpenStep.titleFa}»`
                : "همهٔ بخش‌ها تکمیل شده"}
            </Button>
          )}
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
