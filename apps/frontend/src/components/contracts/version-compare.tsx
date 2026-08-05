// ============================================================
// LEGALIR — Contract Version Compare (Phase 10)
// ============================================================

import type { V1ContractVersionDetail } from "@legalir/types";

interface VersionCompareProps {
  versions: readonly [V1ContractVersionDetail, V1ContractVersionDetail] | null;
  onClose: () => void;
}

export function ContractVersionCompare({ versions, onClose }: VersionCompareProps) {
  if (!versions) {
    return (
      <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 text-center">
        <p className="text-muted">برای مقایسه، دو نسخه را انتخاب کنید</p>
      </div>
    );
  }

  const [v1, v2] = versions;
  const older = v1.versionNumber < v2.versionNumber ? v1 : v2;
  const newer = v1.versionNumber > v2.versionNumber ? v1 : v2;

  // Find changed answers
  const allKeys = new Set([
    ...Object.keys(older.answers),
    ...Object.keys(newer.answers),
  ]);
  const changedKeys = Array.from(allKeys).filter(
    (k) => older.answers[k] !== newer.answers[k]
  );

  return (
    <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 text-on-surface">مقایسه نسخه‌ها</h3>
        <button
          onClick={onClose}
          className="text-caption text-muted hover:text-on-surface touch-target"
          aria-label="بستن مقایسه"
        >
          ✕ بستن
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-medium bg-surface-container p-3 text-center">
          <span className="text-caption text-muted">نسخه قدیمی‌تر</span>
          <p className="text-body-1 font-medium text-on-surface">
            نسخه {older.versionNumber}
          </p>
          <p className="text-caption text-muted">
            {new Date(older.createdAt).toLocaleDateString("fa-IR")}
          </p>
        </div>
        <div className="rounded-medium bg-primary/5 border border-primary/20 p-3 text-center">
          <span className="text-caption text-primary">نسخه جدیدتر</span>
          <p className="text-body-1 font-medium text-on-surface">
            نسخه {newer.versionNumber}
          </p>
          <p className="text-caption text-muted">
            {new Date(newer.createdAt).toLocaleDateString("fa-IR")}
          </p>
        </div>
      </div>

      {/* Changes */}
      {changedKeys.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-h4 text-on-surface">
            {changedKeys.length} تغییر یافت شده
          </h4>
          {changedKeys.map((key) => (
            <div
              key={key}
              className="rounded-medium border border-divider overflow-hidden"
            >
              <div className="bg-surface-container px-4 py-2 border-b border-divider">
                <span className="text-caption font-medium text-on-surface">
                  {key}
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-divider rtl:divide-x-reverse">
                <div className="p-3 bg-red-50/50">
                  <span className="text-caption text-muted block mb-1">
                    نسخه {older.versionNumber}
                  </span>
                  <p className="text-body-2 text-red-700 line-through">
                    {older.answers[key] || "(خالی)"}
                  </p>
                </div>
                <div className="p-3 bg-green-50/50">
                  <span className="text-caption text-muted block mb-1">
                    نسخه {newer.versionNumber}
                  </span>
                  <p className="text-body-2 text-green-700">
                    {newer.answers[key] || "(خالی)"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body-2 text-muted text-center py-4">
          تفاوتی در پاسخ‌های این دو نسخه یافت نشد
        </p>
      )}
    </div>
  );
}
