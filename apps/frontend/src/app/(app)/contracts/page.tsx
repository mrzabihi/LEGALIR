// ============================================================
// LEGALIR — Contracts List Page (Phase 10)
// ============================================================

import { Suspense } from "react";
// Direct module import — the `@/components/contracts` barrel re-exports the
// whole contract component set (wizard, preview, version compare, …), which
// would pull unrelated modules into this list route's client bundle.
import { ContractList } from "@/components/contracts/contract-list";
import { PageContextHeader } from "@/components/shared";

export default function ContractsPage() {
  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" dir="rtl">
      <Suspense fallback={<div className="h-16" aria-hidden="true" />}>
        <PageContextHeader />
      </Suspense>
      <Suspense
        fallback={
          <div className="space-y-3" aria-label="در حال بارگذاری">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-large bg-surface p-4 shadow-elevation-1 border border-divider animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-medium bg-surface-container-high" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-48 bg-surface-container-high rounded-small" />
                    <div className="h-4 w-32 bg-surface-container-high rounded-small" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      >
        <ContractList />
      </Suspense>
    </div>
  );
}
