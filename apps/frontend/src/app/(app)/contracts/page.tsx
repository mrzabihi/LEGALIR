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

export default function ContractsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto max-w-[1400px] space-y-6 p-4 tablet:p-6"
          dir="rtl"
          aria-label="در حال بارگذاری"
        >
          <div className="h-24 animate-pulse rounded-xlarge bg-surface-container" />
          <div className="h-12 w-full max-w-md animate-pulse rounded-full bg-surface-container" />
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-large bg-surface-container" />
            ))}
          </div>
        </div>
      }
    >
      <ContractsHub />
    </Suspense>
  );
}
