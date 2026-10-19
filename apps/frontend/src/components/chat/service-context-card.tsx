"use client";

import { getServiceContext, type ServiceType } from "@/lib/ai/service-context";
import { IconServices } from "@/lib/icons";

const TONE: Record<ServiceType, { iconBg: string; ring: string }> = {
  legal_consultation: { iconBg: "bg-primary-container text-primary", ring: "border-primary" },
  contract_review: { iconBg: "bg-error-container text-error", ring: "border-error" },
  contract_drafting: { iconBg: "bg-success-container text-success", ring: "border-success" },
  legal_notice: { iconBg: "bg-surface-container text-muted", ring: "border-divider" },
  document_analysis: { iconBg: "bg-info-container text-info", ring: "border-info" },
  legal_calculation: { iconBg: "bg-warning-container text-warning", ring: "border-warning" },
  law_search: { iconBg: "bg-secondary-container text-secondary", ring: "border-secondary" },
  case_analysis: { iconBg: "bg-tertiary-container text-tertiary", ring: "border-tertiary" },
};

interface ServiceContextCardProps {
  serviceType?: string | null;
  compact?: boolean;
}

export function ServiceContextCard({
  serviceType,
  compact = false,
}: ServiceContextCardProps) {
  const ctx = getServiceContext(serviceType);
  const tone = TONE[ctx.serviceType];

  // Compact is a SLIM one-line strip, not a card: it must not compete with
  // the conversation for attention or add a second border under the header
  // (§5). The full variant keeps the bordered card for the entry screens.
  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2.5 py-1.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.iconBg}`}
          aria-hidden="true"
        >
          <IconServices size={15} />
        </span>
        <span className="shrink-0 text-labelSmall text-muted">خدمت جاری:</span>
        <span className="truncate text-labelLarge font-medium text-onSurface">
          {ctx.label}
        </span>
        <span className="hidden truncate text-bodySmall text-muted tablet:inline">
          — {ctx.description}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 rounded-large border border-divider bg-surface px-4 py-3 ${tone.ring}`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.iconBg}`}
        aria-hidden="true"
      >
        <IconServices size={20} />
      </span>
      <div className="min-w-0">
        <span className="block text-labelSmall text-muted">خدمت جاری</span>
        <span className="text-labelLarge font-medium text-onSurface">{ctx.label}</span>
        <span className="mt-0.5 block truncate text-bodySmall text-muted">
          {ctx.description}
        </span>
      </div>
    </div>
  );
}
