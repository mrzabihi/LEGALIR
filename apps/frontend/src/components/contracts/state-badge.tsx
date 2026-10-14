// ============================================================
// LEGALIR — Contract State Badge (Phase 10)
// ============================================================

import type { V1ContractState } from "@legalir/types";
import { V1_CONTRACT_STATE_LABELS } from "@legalir/types";

const stateStyles: Record<V1ContractState, string> = {
  draft: "bg-surface-container text-muted border border-divider",
  collecting: "bg-warning-container text-warning border border-warning",
  generated: "bg-info-container text-info-700 border border-info-300",
  under_review: "bg-secondary-container text-secondary-variant border border-secondary-300",
  approved: "bg-success-container text-success border border-success-300",
  exported: "bg-surface-container-high text-muted border border-divider",
  archived: "bg-surface-container-high text-muted border border-divider",
};

const stateDotColors: Record<V1ContractState, string> = {
  draft: "bg-muted",
  collecting: "bg-warning",
  generated: "bg-info",
  under_review: "bg-secondary",
  approved: "bg-success",
  exported: "bg-surface-container-highest",
  archived: "bg-muted",
};

interface StateBadgeProps {
  state: V1ContractState;
}

export function ContractStateBadge({ state }: StateBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-medium px-2.5 py-1 text-label ${stateStyles[state]}`}
      aria-label={`وضعیت: ${V1_CONTRACT_STATE_LABELS[state]}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${stateDotColors[state]}`} />
      {V1_CONTRACT_STATE_LABELS[state]}
    </span>
  );
}
