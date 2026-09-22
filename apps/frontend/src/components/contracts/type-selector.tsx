// ============================================================
// LEGALIR — Contract Type Selector (Phase 10)
// ============================================================

import type { V1ContractTypeInfo, V1ContractType } from "@legalir/types";
import { SelectableCard } from "@legalir/ui";
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
  const { data, isLoading, isError, refetch } = useContractTypes();

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
          onClick={() => refetch()}
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
      <SelectableCard
        selected={isSelected}
        onClick={() => onSelect(info.id)}
        aria-label={`قرارداد ${info.nameFa}`}
        icon={<span className="text-2xl">{typeIcons[info.id] ?? "📄"}</span>}
        title={info.nameFa}
        description={
          <>
            {info.descriptionFa}
            <span className="mt-0.5 block">{info.questionCount} سوال</span>
          </>
        }
      />
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
