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
import { useWizard } from "../wizard-context";

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
