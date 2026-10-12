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

  return (
    <div
      className={`flex items-center gap-3 rounded-large border bg-surface ${tone.ring} ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tone.iconBg}`}
        aria-hidden="true"
      >
        <IconServices size={20} />
      </span>
      <div className="min-w-0">
        <span className="text-labelSmall text-muted block">خدمت جاری</span>
        <span className="text-labelLarge text-onSurface font-medium">
          {ctx.label}
        </span>
        {!compact && (
          <span className="text-bodySmall text-muted mt-0.5 block truncate">
            {ctx.description}
          </span>
        )}
      </div>
    </div>
  );
}
