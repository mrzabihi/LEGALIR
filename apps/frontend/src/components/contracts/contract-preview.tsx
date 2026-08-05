// ============================================================
// LEGALIR — Contract Preview (Phase 10)
// ============================================================

import type { V1ContractVersionDetail } from "@legalir/types";

interface ContractPreviewProps {
  version: V1ContractVersionDetail;
  disclaimer: string;
}

export function ContractPreview({ version, disclaimer }: ContractPreviewProps) {
  return (
    <div className="space-y-4" dir="rtl">
      {/* Disclaimer */}
      <div className="rounded-medium bg-amber-50 border border-amber-200 p-4" role="alert">
        <div className="flex items-start gap-2">
          <span className="text-amber-600 text-xl flex-shrink-0" aria-hidden="true">⚠️</span>
          <div>
            <h4 className="text-body-1 font-medium text-amber-800 mb-1">
              هشدار: این یک پیش‌نویس است
            </h4>
            <p className="text-caption text-amber-700">{disclaimer}</p>
          </div>
        </div>
      </div>

      {/* Contract Content */}
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-divider">
          <h3 className="text-h3 text-on-surface">متن پیش‌نویس قرارداد</h3>
          <span className="text-caption text-muted">نسخه {version.versionNumber}</span>
        </div>

        <div className="prose prose-sm max-w-none text-on-surface whitespace-pre-wrap font-sans leading-relaxed">
          {version.content}
        </div>
      </div>

      {/* Clauses */}
      {version.clauses.length > 0 && (
        <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6">
          <h4 className="text-h4 text-on-surface mb-4">بندهای قرارداد</h4>
          <div className="space-y-3">
            {version.clauses.map((clause) => (
              <div
                key={clause.id}
                className={`rounded-medium p-4 border ${
                  clause.isProtective
                    ? "border-green-200 bg-green-50"
                    : "border-divider"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-body-1 font-medium text-on-surface">
                    {clause.title}
                  </span>
                  {clause.isProtective && (
                    <span className="text-caption bg-green-200 text-green-800 rounded-small px-2 py-0.5">
                      بند حمایتی
                    </span>
                  )}
                  <span
                    className={`text-caption rounded-small px-2 py-0.5 ${
                      clause.importance === "essential"
                        ? "bg-primary/10 text-primary"
                        : clause.importance === "recommended"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-surface-container text-muted"
                    }`}
                  >
                    {clause.importance === "essential"
                      ? "ضروری"
                      : clause.importance === "recommended"
                        ? "توصیه شده"
                        : "اختیاری"}
                  </span>
                </div>
                <p className="text-body-2 text-muted">{clause.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
