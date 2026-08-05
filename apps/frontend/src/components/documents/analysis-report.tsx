// ============================================================
// LEGALIR — Analysis Report
// Main report section combining RiskSummary + FindingCards (Phase 9)
// ============================================================

"use client";

import type { RiskReport } from "@legalir/types";
import { Skeleton, EmptyState, ErrorState } from "@legalir/ui";
import { RiskSummary } from "./risk-summary";
import { FindingCard } from "./finding-card";

// ============================================================
// Helpers
// ============================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

// ============================================================
// Skeleton placeholders
// ============================================================

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Risk summary skeleton */}
      <div className="rounded-large border border-divider bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width="48px" height="48px" />
            <div className="flex flex-col gap-2">
              <Skeleton variant="text" width="160px" height="20px" />
              <Skeleton variant="text" width="96px" height="16px" />
            </div>
          </div>
          <Skeleton variant="circular" width="88px" height="88px" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton variant="text" width="100%" height="16px" />
          <Skeleton variant="text" width="75%" height="16px" />
        </div>
        <div className="mt-4">
          <Skeleton variant="text" width="100%" height="24px" />
        </div>
      </div>

      {/* Finding card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-large border border-divider bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton variant="rectangular" width="4px" height="64px" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton variant="text" width="128px" height="20px" />
              <Skeleton variant="text" width="75%" height="16px" />
            </div>
          </div>
          <Skeleton variant="text" width="100%" height="16px" />
          <Skeleton variant="text" width="66%" height="16px" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// AnalysisReport component
// ============================================================

interface AnalysisReportProps {
  report: RiskReport | null;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function AnalysisReport({
  report,
  isLoading,
  isError,
  onRetry,
}: AnalysisReportProps) {
  // Loading state
  if (isLoading) {
    return (
      <section aria-label="گزارش تحلیل" dir="rtl">
        <h2 className="text-h3 text-on-surface mb-4">گزارش تحلیل</h2>
        <ReportSkeleton />
      </section>
    );
  }

  // Error state
  if (isError) {
    return (
      <section aria-label="گزارش تحلیل" dir="rtl">
        <h2 className="text-h3 text-on-surface mb-4">گزارش تحلیل</h2>
        <ErrorState
          title="خطا در دریافت گزارش"
          message="دریافت گزارش تحلیل با خطا مواجه شد. لطفا دوباره تلاش کنید."
          onRetry={onRetry}
        />
      </section>
    );
  }

  // Empty state
  if (!report || report.findings.length === 0) {
    return (
      <section aria-label="گزارش تحلیل" dir="rtl">
        <h2 className="text-h3 text-on-surface mb-4">گزارش تحلیل</h2>
        <EmptyState
          title="گزارشی یافت نشد"
          description="این سند هنوز تحلیل نشده یا یافته‌ای برای نمایش ندارد."
        />
      </section>
    );
  }

  // Data state
  return (
    <section aria-label="گزارش تحلیل" dir="rtl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-h3 text-on-surface">گزارش تحلیل</h2>
        <span className="text-caption text-muted">
          تاریخ تولید: {formatDate(report.generatedAt)}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Risk summary */}
        <RiskSummary report={report} />

        {/* Findings list */}
        {report.findings.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-labelLarge text-on-surface font-medium">
              یافته‌ها ({report.findings.length})
            </h3>
            {report.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
