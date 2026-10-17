// ============================================================
// LEGALIR — Per-field inline validation in the last two steps
// ============================================================
// The brief's rule is that a step validates its own fields, in place,
// with the message next to the field — never a distant toast and never
// after the fact. These two steps used to be the exception: documents
// and handover had no per-field error at all, so «مرحله بعد» refused
// without pointing at anything.
//
// Pinned here:
//   • the error appears only AFTER an advance attempt;
//   • documents: only an empty REQUIRED slot is flagged, an optional
//     one never is;
//   • handover: the untouched `unrecorded` scaffold is flagged until
//     ONE condition is recorded — then every remaining row is allowed
//     to stay «ثبت‌نشده».
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ContractCompleteness, PropertyContractDetail } from "@legalir/types";

vi.mock("@/lib/api/property-contracts", () => ({
  updatePropertyContract: vi.fn().mockResolvedValue({}),
  savePayments: vi.fn().mockResolvedValue([]),
}));

import { WizardProvider, useWizard } from "../../wizard-context";
import { DocumentsStep } from "../documents";
import { HandoverStep } from "../handover";
import { getContractDefinition } from "@/lib/contracts/registry";

/** Calls the REAL provider gate, exactly as the «مرحله بعد» button does. */
function AdvanceProbe() {
  const { goNext } = useWizard();
  return (
    <button type="button" onClick={goNext}>
      probe-advance
    </button>
  );
}

const COMPLETENESS = { overall: 0, sections: [], blockers: [] } as unknown as ContractCompleteness;

function makeContract(step: string, data: Record<string, unknown> = {}): PropertyContractDetail {
  return {
    id: "pc-validation",
    type: "property_rent",
    typeFa: "رهن و اجاره ملک مسکونی",
    state: "DRAFT",
    title: "قرارداد تست",
    referenceCode: "LGL-RENT-1405-000001",
    currentStep: step,
    progress: 0,
    data,
    payments: [],
    parties: [],
    documents: [],
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  } as unknown as PropertyContractDetail;
}

function renderStep(step: string, ui: React.ReactNode, data: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider contract={makeContract(step, data)} completeness={COMPLETENESS}>
        {ui}
      </WizardProvider>
    </QueryClientProvider>
  );
}

describe("documents step — inline validation", () => {
  it("flags an empty required slot only after an advance attempt", () => {
    const def = getContractDefinition("property_rent");
    const required = def.requiredDocuments.filter((d) => d.required);
    const optional = def.requiredDocuments.filter((d) => !d.required);
    // The fixture must exercise both branches, or this test proves nothing.
    expect(required.length).toBeGreaterThan(0);
    expect(optional.length).toBeGreaterThan(0);

    renderStep(
      "documents",
      <>
        <AdvanceProbe />
        <DocumentsStep />
      </>
    );

    // Before any attempt: the reader sees the neutral empty state.
    expect(screen.queryByText("بارگذاری این مدرک الزامی است.")).toBeNull();

    fireEvent.click(screen.getByText("probe-advance"));

    expect(screen.getAllByText("بارگذاری این مدرک الزامی است.")).toHaveLength(
      required.length
    );
  });
});

describe("handover step — inline validation", () => {
  it("flags the untouched scaffold, then clears once one condition is recorded", () => {
    const base = getContractDefinition("property_rent").createDefaultData("apartment");
    renderStep(
      "handover",
      <>
        <AdvanceProbe />
        <HandoverStep />
      </>,
      base as unknown as Record<string, unknown>
    );

    expect(screen.queryAllByText("تکمیل این فیلد الزامی است.")).toHaveLength(0);

    fireEvent.click(screen.getByText("probe-advance"));
    // Every row is still «ثبت‌نشده», so each condition select is flagged.
    expect(screen.getAllByText("تکمیل این فیلد الزامی است.").length).toBeGreaterThan(0);

    // Record ONE condition — the section is satisfied, so the inline
    // errors must disappear instead of shaming rows that may stay open.
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "intact" } });

    expect(screen.queryAllByText("تکمیل این فیلد الزامی است.")).toHaveLength(0);
  });
});
