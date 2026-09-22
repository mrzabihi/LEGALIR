// ============================================================
// LEGALIR — Wizard step registry
// ============================================================
// Maps a registry step id to the component that renders it. The
// wizard shell knows nothing about contract types: it looks up
// `STEP_COMPONENTS[step.id]` and renders whatever it finds.
//
// Two step ids are shared by both journeys ("financial" and
// "obligations"), so those entries dispatch on the contract type
// internally. Adding a new domain means adding a definition to the
// contract registry and, at most, one entry here.
// ============================================================

import { createElement, type ComponentType } from "react";
import { PartiesStep } from "./parties";
import { PropertyStep } from "./property";
import { OwnershipStep } from "./ownership";
import { FinancialRentStep } from "./financial-rent";
import { FinancialSaleStep } from "./financial-sale";
import { RegistrationStep } from "./registration";
import { ObligationsStep } from "./obligations";
import { HandoverStep } from "./handover";
import { DocumentsStep } from "./documents";
import { ReviewStep } from "./review";
import { SchemaStep } from "./schema-step";
import { useWizard } from "../wizard-context";
import { getContractDefinition } from "@/lib/contracts/registry";

/** The "financial" step: rent terms or sale price + schedule. */
function FinancialStep() {
  const { contract } = useWizard();
  return createElement(
    contract.type === "property_sale" ? FinancialSaleStep : FinancialRentStep
  );
}

export const STEP_COMPONENTS: Record<string, ComponentType> = {
  parties: PartiesStep,
  property: PropertyStep,
  ownership: OwnershipStep,
  financial: FinancialStep,
  registration: RegistrationStep,
  obligations: ObligationsStep,
  handover: HandoverStep,
  documents: DocumentsStep,
  review: ReviewStep,
};

/**
 * Steps that are shared by every contract type regardless of schema.
 * The parties step edits the party rows (not domain data), and the
 * documents step edits uploads — neither is driven by field
 * descriptors, so both keep their hand-written components.
 */
const SHARED_STEPS: Record<string, ComponentType> = {
  parties: PartiesStep,
  documents: DocumentsStep,
  review: ReviewStep,
};

/**
 * Resolve the component for a given contract type + step id.
 *
 * Schema-driven contract types (anything whose registry definition
 * declares `fields`) render their data steps through the single
 * `SchemaStep`, which reads the field descriptors for that step. The
 * shared parties/documents/review steps and the bespoke property
 * journeys keep their hand-written components.
 */
export function stepComponentFor(typeId: string, stepId: string): ComponentType | null {
  const def = getContractDefinition(typeId as never);
  if (def.fields.length > 0) {
    return SHARED_STEPS[stepId] ?? SchemaStep;
  }
  return STEP_COMPONENTS[stepId] ?? null;
}
