// ============================================================
// LEGALIR — Contract Risk Analysis Panel (Phase 10)
// ============================================================

import type { V1ContractRiskAnalysis } from "@legalir/types";
import { useContractAnalysis } from "@/hooks/useContracts";

const riskColorMap = {
  low: "bg-green-50 border-green-200 text-green-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  high: "bg-orange-50 border-orange-200 text-orange-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

const riskLabelMap = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  critical: "بحرانی",
};

const severityIconMap = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

interface RiskPanelProps {
  contractId: string;
  analysis?: V1ContractRiskAnalysis | null;
}

export function ContractRiskPanel({ contractId, analysis: initialAnalysis }: RiskPanelProps) {
  const { data: fetchedAnalysis, isLoading, isError, error } = useContractAnalysis(contractId);
  const analysis = initialAnalysis ?? fetchedAnalysis ?? null;

  if (isLoading && !initialAnalysis) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 animate-pulse" aria-label="در حال بارگذاری تحلیل ریسک">
        <div className="h-6 w-32 bg-surface-container rounded-small mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-surface-container rounded-medium" />
          <div className="h-16 bg-surface-container rounded-medium" />
        </div>
      </div>
    );
  }

  if (isError && !initialAnalysis) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 text-center" role="alert">
        <p className="text-error mb-2">{(error as Error)?.message ?? "خطا در دریافت تحلیل ریسک"}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 text-center">
        <p className="text-muted">تحلیل ریسک برای این قرارداد موجود نیست</p>
      </div>
    );
  }

  return (
    <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 space-y-4" dir="rtl">
      <h3 className="text-h3 text-on-surface">تحلیل ریسک</h3>

      {/* Overall Risk */}
      <div
        className={`rounded-medium p-4 border ${riskColorMap[analysis.overallRisk]}`}
      >
        <span className="text-body-1 font-medium">
          ریسک کلی: {riskLabelMap[analysis.overallRisk]}
        </span>
      </div>

      {/* Findings */}
      {analysis.findings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-h4 text-on-surface">
            یافته‌ها ({analysis.findings.length})
          </h4>
          {analysis.findings.map((finding) => (
            <div
              key={finding.id}
              className={`rounded-medium p-4 border ${riskColorMap[finding.severity]}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span aria-hidden="true">{severityIconMap[finding.severity]}</span>
                <h5 className="text-body-1 font-medium">{finding.title}</h5>
                <span className="text-caption px-2 py-0.5 rounded-small bg-white/50">
                  {riskLabelMap[finding.severity]}
                </span>
              </div>
              <p className="text-body-2 mb-2">{finding.description}</p>
              <p className="text-caption font-medium">
                پیشنهاد: {finding.suggestion}
              </p>
              {finding.clauseRef && (
                <p className="text-caption text-muted mt-1">
                  مرتبط با بند: {finding.clauseRef}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Protective Suggestions */}
      {analysis.protectiveSuggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-h4 text-on-surface">
            بندهای حمایتی پیشنهادی ({analysis.protectiveSuggestions.length})
          </h4>
          {analysis.protectiveSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-medium p-4 border border-green-200 bg-green-50"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-body-1 font-medium text-green-800">
                  {suggestion.title}
                </span>
                <span
                  className={`text-caption rounded-small px-2 py-0.5 ${
                    suggestion.importance === "essential"
                      ? "bg-green-200 text-green-800"
                      : suggestion.importance === "recommended"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-surface-container text-muted"
                  }`}
                >
                  {suggestion.importance === "essential"
                    ? "ضروری"
                    : suggestion.importance === "recommended"
                      ? "توصیه شده"
                      : "اختیاری"}
                </span>
              </div>
              <p className="text-body-2 text-green-700">{suggestion.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
