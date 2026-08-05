// ============================================================
// LEGALIR — Contract Wizard Page (Phase 10)
// ============================================================

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { V1ContractType } from "@legalir/types";
import { ContractTypeSelector } from "@/components/contracts/type-selector";
import { ContractWizard } from "@/components/contracts/wizard";

function NewContractContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get("type") as V1ContractType | null;

  const [step, setStep] = useState<"select" | "wizard">(
    preselectedType ? "wizard" : "select"
  );
  const [selectedType, setSelectedType] = useState<V1ContractType | null>(
    preselectedType
  );
  const [title, setTitle] = useState("");

  function handleTypeSelect(type: V1ContractType) {
    setSelectedType(type);
  }

  function handleContinue() {
    if (selectedType) {
      setStep("wizard");
    }
  }

  function handleBack() {
    setStep("select");
    setSelectedType(null);
  }

  if (step === "wizard" && selectedType) {
    return (
      <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
        {/* Title Input (only if not preselected) */}
        {!title && !preselectedType && (
          <div className="mb-6" dir="rtl">
            <label className="block text-body-1 font-medium text-on-surface mb-2">
              عنوان قرارداد
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: قرارداد اجاره آپارتمان تهران"
              className="w-full rounded-medium px-4 py-3 text-body-2 text-on-surface placeholder:text-muted border border-divider focus:outline-none focus:ring-2 focus:ring-primary bg-surface touch-target"
            />
            {!title && (
              <p className="text-caption text-muted mt-1">
                یک عنوان برای قرارداد خود وارد کنید
              </p>
            )}
            {title && (
              <div className="mt-4">
                <ContractWizard
                  typeId={selectedType}
                  title={title}
                  onBack={handleBack}
                />
              </div>
            )}
          </div>
        )}

        {(title || preselectedType) && (
          <ContractWizard
            typeId={selectedType}
            title={title || `قرارداد ${selectedType === "lease" ? "اجاره" : selectedType === "nda" ? "NDA" : selectedType === "employment" ? "استخدام" : selectedType}`}
            onBack={handleBack}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
      <div className="mb-6" dir="rtl">
        <button
          onClick={() => router.back()}
          className="text-muted hover:text-on-surface text-button touch-target mb-4 inline-flex items-center gap-1"
        >
          ← بازگشت
        </button>
        <h1 className="text-h2 text-on-surface">ایجاد قرارداد جدید</h1>
        <p className="text-body-2 text-muted mt-1">
          نوع قرارداد مورد نظر خود را انتخاب کنید
        </p>
      </div>

      <ContractTypeSelector
        selectedType={selectedType}
        onSelect={handleTypeSelect}
        onContinue={handleContinue}
      />
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-surface-container rounded-small" />
            <div className="h-24 bg-surface-container rounded-large" />
            <div className="h-24 bg-surface-container rounded-large" />
          </div>
        </div>
      }
    >
      <NewContractContent />
    </Suspense>
  );
}
