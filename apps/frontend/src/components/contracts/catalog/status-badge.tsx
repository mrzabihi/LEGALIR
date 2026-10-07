// ============================================================
// LEGALIR — Contract service status badge
// ============================================================
// A small, informational pill. «به‌زودی» is a status label, NOT a disabled
// control — the card around it stays fully interactive so the service never
// reads as broken. Tones come from the shared warning/success ramps.

import {
  CONTRACT_SERVICE_STATUS_FA,
  CONTRACT_SERVICE_STATUS_LONG_FA,
  type ContractServiceStatus,
} from "@/lib/contract-services";

const TONE: Record<ContractServiceStatus, string> = {
  "coming-soon": "border-warning-200 bg-warning-50 text-warning-700",
  active: "border-success-200 bg-success-50 text-success-700",
};

interface ContractServiceStatusBadgeProps {
  status: ContractServiceStatus;
  /** `long` spells out «به‌زودی فعال می‌شود» for the detail page hero. */
  variant?: "short" | "long";
  className?: string;
}

export function ContractServiceStatusBadge({
  status,
  variant = "short",
  className = "",
}: ContractServiceStatusBadgeProps) {
  const label =
    variant === "long"
      ? CONTRACT_SERVICE_STATUS_LONG_FA[status]
      : CONTRACT_SERVICE_STATUS_FA[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TONE[status]} ${className}`}
    >
      {variant === "short" && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}
