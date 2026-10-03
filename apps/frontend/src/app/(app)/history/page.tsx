// ============================================================
// LEGALIR — History Page (route)
// ============================================================
// Thin route wrapper. The interactive surface lives in
// `HistoryWorkspace`, which reads `?archived=true` from the URL — so it
// must be wrapped in Suspense (Next.js requires this for
// `useSearchParams` in a statically-rendered route).
// ============================================================

import { Suspense } from "react";
import { HistoryWorkspace } from "@/components/history/history-workspace";

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 tablet:p-6 max-w-4xl mx-auto" aria-label="در حال بارگذاری">
          <div className="h-8 w-40 bg-surface-container-high rounded-small mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-large bg-surface p-4 shadow-elevation-1 border border-divider animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-48 bg-surface-container-high rounded-small" />
                    <div className="h-4 w-32 bg-surface-container-high rounded-small" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <HistoryWorkspace />
    </Suspense>
  );
}
