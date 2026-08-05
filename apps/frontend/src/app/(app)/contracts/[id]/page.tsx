// ============================================================
// LEGALIR — Contract Detail Page (Phase 10)
// ============================================================

"use client";

import { use, Suspense } from "react";
import { useContractDetail } from "@/hooks/useContracts";
import { ContractDetailView } from "@/components/contracts/contract-detail";
import Link from "next/link";

function ContractDetailContent({ id }: { id: string }) {
  const { data: contract, isLoading, isError, error, refetch } = useContractDetail(id);

  if (isLoading) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto" aria-label="در حال بارگذاری" dir="rtl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-surface-container rounded-small" />
          <div className="h-5 w-32 bg-surface-container rounded-small" />
          <div className="h-4 w-full bg-surface-container rounded-small" />
          <div className="h-60 bg-surface-container rounded-large mt-4" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-h3 text-on-surface mb-2">
            {error instanceof Error && error.message.includes("404")
              ? "قرارداد یافت نشد"
              : "خطا در دریافت اطلاعات"}
          </h3>
          <p className="text-body-2 text-muted mb-4">
            {(error as Error)?.message ?? "خطای نامشخص"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refetch()}
              className="rounded-medium bg-primary text-white px-5 py-3 text-button touch-target"
            >
              تلاش مجدد
            </button>
            <Link
              href="/contracts"
              className="rounded-medium bg-surface-container text-on-surface px-5 py-3 text-button touch-target border border-divider"
            >
              بازگشت به لیست
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-h3 text-on-surface mb-2">قرارداد یافت نشد</h3>
          <Link
            href="/contracts"
            className="rounded-medium bg-primary text-white px-5 py-3 text-button touch-target inline-block mt-4"
          >
            بازگشت به لیست قراردادها
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto">
      {/* Back Link */}
      <Link
        href="/contracts"
        className="text-muted hover:text-on-surface text-button touch-target mb-4 inline-flex items-center gap-1"
      >
        ← بازگشت به لیست
      </Link>

      <ContractDetailView contract={contract} />
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContractDetailPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl" aria-label="در حال بارگذاری">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-surface-container rounded-small" />
            <div className="h-5 w-32 bg-surface-container rounded-small" />
            <div className="h-60 bg-surface-container rounded-large mt-4" />
          </div>
        </div>
      }
    >
      <ContractDetailContent id={id} />
    </Suspense>
  );
}
