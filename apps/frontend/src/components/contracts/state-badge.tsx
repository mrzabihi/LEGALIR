// ============================================================
// LEGALIR — Contract State Badge (Phase 10)
// ============================================================

import type { V1ContractState } from "@legalir/types";
import { V1_CONTRACT_STATE_LABELS } from "@legalir/types";

const stateStyles: Record<V1ContractState, string> = {
  draft: "bg-surface-container text-muted border border-divider",
  collecting: "bg-amber-50 text-amber-700 border border-amber-200",
  generated: "bg-blue-50 text-blue-700 border border-blue-200",
  under_review: "bg-purple-50 text-purple-700 border border-purple-200",
  approved: "bg-green-50 text-green-700 border border-green-200",
  exported: "bg-teal-50 text-teal-700 border border-teal-200",
  archived: "bg-surface-container-high text-muted border border-divider",
};

const stateDotColors: Record<V1ContractState, string> = {
  draft: "bg-muted",
  collecting: "bg-amber-500",
  generated: "bg-blue-500",
  under_review: "bg-purple-500",
  approved: "bg-green-500",
  exported: "bg-teal-500",
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
