// ============================================================
// LEGALIR — Global Loading Conventions
// ============================================================

import type { ReactNode } from "react";

// --- Page-level Skeleton ---

export function PageLoadingSkeleton() {
  return (
    <div className="flex min-h-[60vh] animate-pulse flex-col gap-6 p-6" aria-busy="true">
      {/* Title bar */}
      <div className="h-8 w-48 rounded-medium bg-muted/20" />
      {/* Card area */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-large border border-muted/10 bg-surface p-6">
            <div className="mb-4 h-5 w-24 rounded-small bg-muted/20" />
            <div className="mb-2 h-4 w-full rounded-small bg-muted/10" />
            <div className="mb-2 h-4 w-3/4 rounded-small bg-muted/10" />
            <div className="h-4 w-1/2 rounded-small bg-muted/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Inline skeleton for a single card ---

export function CardLoadingSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-large border border-muted/10 bg-surface p-6"
          aria-hidden="true"
        >
          <div className="mb-3 h-5 w-24 rounded-small bg-muted/20" />
          <div className="mb-2 h-4 w-full rounded-small bg-muted/10" />
          <div className="h-4 w-2/3 rounded-small bg-muted/10" />
        </div>
      ))}
    </>
  );
}

// --- Suspense boundary helper ---

export function SuspensePage({
  children,
  fallback: _fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{children}</>;
}

// --- Text loading indicator ---

export function LoadingText({ text = "در حال بارگذاری..." }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted" role="status">
      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {text}
    </span>
  );
}
