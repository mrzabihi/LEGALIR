// ============================================================
// LEGALIR — All configurable contracts (/contracts/templates)
// ============================================================
// The full listing behind the hub's «مشاهده همه قراردادها» link.
//
// A dedicated route (not an in-place expansion of the home rail) so the
// listing can carry its own URL-backed search, category filter and page
// — refresh, deep-link and Back all work, and the hub stays short.
//
// Wrapped in Suspense because the browser reads `useSearchParams`.

import { Suspense } from "react";
import { TemplatesBrowser } from "@/components/contracts/templates-browser";

export default function ContractTemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1120px] space-y-5 p-4 tablet:p-6" dir="rtl">
          <div className="h-9 w-52 animate-pulse rounded-medium bg-surface-container" />
          <div className="h-12 w-full animate-pulse rounded-medium bg-surface-container" />
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-pulse rounded-large bg-surface-container" />
            ))}
          </div>
        </div>
      }
    >
      <TemplatesBrowser />
    </Suspense>
  );
}
