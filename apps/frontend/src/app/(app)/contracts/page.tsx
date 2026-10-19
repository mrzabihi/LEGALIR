// ============================================================
// LEGALIR — Contracts Hub (/contracts)
// ============================================================
// The single, comprehensive contract-drafting surface. It hosts BOTH
// things the user needs, switched in place by a real segmented control:
//
//   • «قراردادهای فعال»       — the template library + the user's own
//                              contracts and drafts (the former /contracts/my)
//   • «بزودی»                 — the future contract services catalog
//
// Everything lives in the client `ContractsHub` (URL-backed view + filters),
// so it is wrapped in a Suspense boundary to keep the route statically
// renderable. `/contracts/my` now redirects here with the active view
// selected.

import { Suspense } from "react";
import { ContractsHub } from "@/components/contracts/contracts-hub";
import { PageContainer } from "@/components/shared/page-container";

export default function ContractsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-4" dir="rtl" aria-label="در حال بارگذاری">
          {/* Mirrors the real first paint: header, the two path cards,
              then the (short) search row — so nothing jumps on hydrate. */}
          <div className="h-20 animate-pulse rounded-large bg-surface-container" />
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-large bg-surface-container" />
            ))}
          </div>
          <div className="h-14 w-full animate-pulse rounded-medium bg-surface-container" />
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[372px] animate-pulse rounded-large bg-surface-container" />
            ))}
          </div>
        </PageContainer>
      }
    >
      <ContractsHub />
    </Suspense>
  );
}
