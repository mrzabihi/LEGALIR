// ============================================================
// LEGALIR — Contract Type Selector (Phase 10)
// ============================================================

import type { V1ContractTypeInfo, V1ContractType } from "@legalir/types";
import { useContractTypes } from "@/hooks/useContracts";

const typeIcons: Record<string, string> = {
  lease: "🏠",
  sale_purchase: "🛒",
  loan: "💰",
  partnership: "🤝",
  nda: "🛡️",
  employment: "💼",
  saas: "☁️",
  contracting: "🏗️",
  investment: "📈",
};

interface TypeSelectorProps {
  selectedType: V1ContractType | null;
  onSelect: (type: V1ContractType) => void;
  onContinue: () => void;
}

export function ContractTypeSelector({
  selectedType,
  onSelect,
  onContinue,
}: TypeSelectorProps) {
  const { data, isLoading, isError } = useContractTypes();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="در حال بارگذاری انواع قرارداد">
        <div className="h-24 bg-surface-container rounded-large animate-pulse" />
        <div className="h-24 bg-surface-container rounded-large animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center p-6">
        <p className="text-error mb-2">خطا در دریافت انواع قرارداد</p>
        <button
          onClick={() => window.location.reload()}
          className="text-primary text-button"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  function TypeCard({ info }: { info: V1ContractTypeInfo }) {
    const isSelected = selectedType === info.id;
    return (
      <button
        onClick={() => onSelect(info.id)}
        className={`w-full rounded-large p-4 border-2 text-right transition-all touch-target ${
          isSelected
            ? "border-primary bg-primary/5"
            : "border-divider bg-surface hover:border-primary/30"
        }`}
        aria-pressed={isSelected}
        aria-label={`قرارداد ${info.nameFa}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            {typeIcons[info.id] ?? "📄"}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="text-body-1 font-medium text-on-surface">
              {info.nameFa}
            </h4>
            <p className="text-caption text-muted mt-0.5">
              {info.descriptionFa}
            </p>
            <p className="text-caption text-muted mt-0.5">
              {info.questionCount} سوال
            </p>
          </div>
          {isSelected && (
            <span className="text-primary text-h3" aria-hidden="true">
              ✓
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Personal Section */}
      <div>
        <h3 className="text-h3 text-on-surface mb-3">قراردادهای شخصی</h3>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          {data.personal.map((info) => (
            <TypeCard key={info.id} info={info} />
          ))}
        </div>
      </div>

      {/* Business Section */}
      <div>
        <h3 className="text-h3 text-on-surface mb-3">قراردادهای تجاری</h3>
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          {data.business.map((info) => (
            <TypeCard key={info.id} info={info} />
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onContinue}
          disabled={!selectedType}
          className={`rounded-medium px-6 py-3 text-button transition-colors touch-target ${
            selectedType
              ? "bg-primary text-white hover:bg-primary-dark"
              : "bg-surface-container text-muted cursor-not-allowed"
          }`}
          aria-label="ادامه به پرسشنامه"
        >
          ادامه
        </button>
      </div>
    </div>
  );
}
