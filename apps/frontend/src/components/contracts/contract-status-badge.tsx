// ============================================================
// LEGALIR — Contract status badge
// ============================================================
// The one badge every contract card uses. It always renders the label
// alongside the colour dot, so a status is never communicated by
// colour alone — the accessibility requirement of the spec.
// ============================================================

import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  STATUS_DOT_CLASSES,
  STATUS_TONE_CLASSES,
  type ContractStatusGroup,
} from "@/lib/contracts/status";

interface ContractStatusBadgeProps {
  status: ContractStatusGroup;
  /** Override the label (e.g. the raw lifecycle state). */
  label?: string;
  className?: string;
}

export function ContractStatusBadge({
  status,
  label,
  className = "",
}: ContractStatusBadgeProps) {
  const tone = CONTRACT_STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-labelSmall ${STATUS_TONE_CLASSES[tone]} ${className}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[tone]}`}
        aria-hidden="true"
      />
      {label ?? CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}
