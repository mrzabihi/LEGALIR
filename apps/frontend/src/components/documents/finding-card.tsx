// ============================================================
// LEGALIR — Finding Card
// Individual analysis finding with risk level, explanation,
// recommendation, confidence, and citation (Phase 9)
// ============================================================

"use client";

import type { DocumentFinding } from "@legalir/types";
import { Card } from "@legalir/ui";
import { IconLinkSource, IconInfo } from "@/lib/icons";

// ============================================================
// Config maps
// ============================================================

const SEVERITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; barColor: string }
> = {
  critical: {
    label: "بحرانی",
    badgeClass: "bg-error-container text-error border-error",
    barColor: "bg-error",
  },
  high: {
    label: "زیاد",
    badgeClass: "bg-warning-container text-warning border-warning",
    barColor: "bg-warning-400",
  },
  medium: {
    label: "متوسط",
    badgeClass: "bg-warning-container text-warning border-warning",
    barColor: "bg-warning-700",
  },
  low: {
    label: "کم",
    badgeClass: "bg-success-container text-success border-success",
    barColor: "bg-success",
  },
};

const CONFIDENCE_THRESHOLDS = [
  { min: 80, label: "اطمینان بالا", className: "text-success" },
  { min: 50, label: "اطمینان متوسط", className: "text-warning" },
  { min: 0, label: "اطمینان پایین", className: "text-error" },
];

function getConfidenceLabel(confidence: number): {
  label: string;
  className: string;
} {
  for (const t of CONFIDENCE_THRESHOLDS) {
    if (confidence >= t.min) return { label: t.label, className: t.className };
  }
  return { label: "اطمینان پایین", className: "text-error" };
}

// ============================================================
// FindingCard component
// ============================================================

interface FindingCardProps {
  finding: DocumentFinding;
}

export function FindingCard({ finding }: FindingCardProps) {
  const { title, severity, locator, reason, recommendation, citation, confidence } =
    finding;

  const severityConfig = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG['low'];

  const barColor = severityConfig?.barColor ?? 'bg-muted';
  const badgeClass = severityConfig?.badgeClass ?? 'bg-surface-container text-muted border-divider';
  const label = severityConfig?.label ?? 'نامشخص';
  const confidenceInfo = getConfidenceLabel(confidence);

  return (
    <Card variant="outlined" padding="medium" className="flex flex-col gap-3">
      {/* Severity bar + header */}
      <div className="flex items-start gap-3">
        {/* Color bar */}
        <div
          className={`w-1 self-stretch shrink-0 rounded-full ${barColor}`}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          {/* Severity badge + title */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium border ${badgeClass}`}
              aria-label={`شدت: ${label}`}
            >
              {label}
            </span>
            <h4 className="text-body-2 text-on-surface font-bold">{title}</h4>
          </div>

          {/* Location */}
          {locator && (
            <p className="text-caption text-muted mt-1">
              <span className="font-medium">موقعیت: </span>
              {locator}
            </p>
          )}
        </div>
      </div>

      {/* Explanation */}
      {reason && (
        <div>
          <p className="text-caption font-medium text-on-surface mb-1">توضیح:</p>
          <p className="text-caption text-muted leading-relaxed">{reason}</p>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="rounded-medium bg-info-container border border-info p-3">
          <div className="flex items-start gap-2">
            <IconInfo size={18} className="text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-caption font-medium text-info mb-0.5">توصیه:</p>
              <p className="text-caption text-info leading-relaxed">
                {recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom meta: confidence + citation */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-divider">
        {/* Confidence */}
        <span
          className={`text-caption font-medium ${confidenceInfo.className}`}
          aria-label={`میزان اطمینان: ${confidence} درصد`}
        >
          {confidenceInfo.label}: {Math.round(confidence)}٪
        </span>

        {/* Citation */}
        {citation ? (
          citation.locator ? (
            <span className="text-caption text-muted flex items-center gap-1">
              <IconLinkSource size={14} />
              <span>منبع: {citation.locator}</span>
            </span>
          ) : (
            <span className="text-caption text-muted flex items-center gap-1">
              <IconLinkSource size={14} />
              <span>دارای منبع</span>
            </span>
          )
        ) : (
          <span className="text-caption text-muted">منبع مشخصی موجود نیست</span>
        )}
      </div>
    </Card>
  );
}
