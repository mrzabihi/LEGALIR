// ============================================================
// LEGALIR — Performance Utilities (Phase 12)
// ============================================================

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Dynamically import a page component with a named export.
 * Usage: const Page = dynamicImport(() => import("./page"))
 */
export function dynamicImport<T extends ComponentType<object>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  return dynamic(importFn, {
    loading: () => fallback ?? <DefaultLoading />,
    ssr: true,
  });
}

function DefaultLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
        />
        <p className="text-body-2 text-muted">در حال بارگذاری...</p>
      </div>
    </div>
  );
}

// ============================================================
// Bundle analysis info
// Run `npx next build --debug` or `ANALYZE=true next build`
// to see bundle size breakdown.
// ============================================================
