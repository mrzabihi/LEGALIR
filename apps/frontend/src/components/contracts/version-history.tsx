// ============================================================
// LEGALIR — Contract Version History (Phase 10)
// ============================================================

import type { V1ContractVersionDetail } from "@legalir/types";
import { ContractStateBadge } from "./state-badge";

interface VersionHistoryProps {
  versions: V1ContractVersionDetail[];
  currentVersionId: string | null;
  selectedVersions: string[];
  onToggleCompare: (versionId: string) => void;
  onViewVersion: (versionId: string) => void;
  compareMode: boolean;
}

export function ContractVersionHistory({
  versions,
  currentVersionId,
  selectedVersions,
  onToggleCompare,
  onViewVersion,
  compareMode,
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 text-center">
        <p className="text-muted">نسخه‌ای برای این قرارداد ثبت نشده است</p>
      </div>
    );
  }

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 text-on-surface">تاریخچه نسخه‌ها</h3>
        <span className="text-caption text-muted">{versions.length} نسخه</span>
      </div>

      <div className="space-y-2">
        {sorted.map((version, idx) => {
          const isCurrent = version.id === currentVersionId;
          const isSelected = selectedVersions.includes(version.id);

          return (
            <div
              key={version.id}
              className={`rounded-medium p-4 border transition-colors ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isSelected
                    ? "border-blue-300 bg-blue-50"
                    : "border-divider"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-body-1 font-medium text-on-surface">
                    نسخه {version.versionNumber}
                  </span>
                  {isCurrent && (
                    <span className="text-caption bg-primary/10 text-primary rounded-small px-2 py-0.5">
                      فعلی
                    </span>
                  )}
                  <ContractStateBadge state={version.state} />
                </div>
                <span className="text-caption text-muted">
                  {new Date(version.createdAt).toLocaleDateString("fa-IR")}
                </span>
              </div>

              {/* Version diff hint */}
              {idx < sorted.length - 1 && (
                <p className="text-caption text-muted mb-3">
                  تغییرات نسبت به نسخه {sorted[idx + 1]!.versionNumber}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onViewVersion(version.id)}
                  className="text-caption text-primary hover:underline touch-target"
                >
                  مشاهده
                </button>
                {compareMode && (
                  <button
                    onClick={() => onToggleCompare(version.id)}
                    className={`text-caption touch-target ${
                      isSelected ? "text-blue-600" : "text-muted"
                    }`}
                  >
                    {isSelected ? "✓ انتخاب شده" : "مقایسه"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
