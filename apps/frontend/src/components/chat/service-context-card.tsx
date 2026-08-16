"use client";

import { getServiceContext, type ServiceType } from "@/lib/ai/service-context";
import { IconServices } from "@/lib/icons";

const TONE: Record<ServiceType, { iconBg: string; ring: string }> = {
  legal_consultation: { iconBg: "bg-primary/10 text-primary", ring: "border-primary/20" },
  contract_review: { iconBg: "bg-rose-50 text-rose-600", ring: "border-rose-200" },
  contract_drafting: { iconBg: "bg-emerald-50 text-emerald-600", ring: "border-emerald-200" },
  legal_notice: { iconBg: "bg-stone-100 text-stone-600", ring: "border-stone-200" },
  document_analysis: { iconBg: "bg-blue-50 text-blue-600", ring: "border-blue-200" },
  legal_calculation: { iconBg: "bg-amber-50 text-amber-600", ring: "border-amber-200" },
  law_search: { iconBg: "bg-indigo-50 text-indigo-600", ring: "border-indigo-200" },
  case_analysis: { iconBg: "bg-purple-50 text-purple-600", ring: "border-purple-200" },
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
