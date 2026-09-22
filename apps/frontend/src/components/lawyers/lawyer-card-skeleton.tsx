"use client";

// ============================================================
// LEGALIR — Lawyer Card Skeleton
// ============================================================
// Mirrors the real card's block structure (avatar, name, rating, chips,
// meta, availability, price, CTA) so the loading state reserves the same
// height and the grid does not shift when data arrives.
// ============================================================

export function LawyerCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-divider/60 bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-full bg-surface-container" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-container" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-container" />
            <div className="h-3 w-24 animate-pulse rounded bg-surface-container" />
          </div>
        </div>

        <div className="flex min-h-[58px] flex-wrap content-start gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded-full bg-surface-container" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-surface-container" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-surface-container" />
        </div>

        <div className="h-5 w-40 animate-pulse rounded bg-surface-container" />
        <div className="flex flex-col gap-0.5">
          <div className="h-5 w-24 animate-pulse rounded bg-surface-container" />
          <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="mb-3 flex items-end justify-between border-t border-divider/60 pt-3">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-surface-container" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-surface-container" />
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-surface-container" />
        </div>
      </div>
    </div>
  );
}
