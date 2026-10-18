// ============================================================
// LEGALIR — Contracts hub header
// ============================================================
// The shared header for the unified /contracts hub. It resolves the
// active service from the URL (the single source of truth) and is
// rendered ABOVE the two-tab switcher, so it stays pixel-identical when
// the user switches between «قراردادهای فعال» and «بزودی».
//
// The page offers TWO services that must never be confused:
//
//   • تنظیم قرارداد  — build a new contract from a template
//   • بررسی قرارداد  — have an EXISTING contract analysed
//
// Those two entries are now large, distinct PATH CARDS rendered directly
// below this header (`ContractPathCards`), so the identity block itself
// stays a quiet title: breadcrumb, one H1, one short line. The cards own
// the destinations; the header never duplicates them as small pills.
//
// It is a thin wrapper over the shared `CompactPageHeader`, so this page
// can never drift from the rest of the list surfaces.
// ============================================================

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveService } from "@/lib/services";
import { CompactPageHeader } from "@/components/shared";

interface ContractsPageHeaderProps {
  /** Extra classes for the header wrapper. */
  className?: string;
}

export function ContractsPageHeader({ className = "" }: ContractsPageHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const service = resolveService(pathname, searchParams);
  const title = service?.title ?? "تنظیم قرارداد";

  return (
    <CompactPageHeader
      className={className}
      // The list region above the contracts list must stay short, so this
      // page uses the tighter header rhythm.
      compact
      // The nav keeps its historical accessible name; `service-navigation`
      // asserts a navigation labelled «breadcrumb» on this route.
      breadcrumbAriaLabel="breadcrumb"
      breadcrumb={[{ label: "داشبورد", href: "/dashboard" }, { label: title }]}
      title={title}
      // One short line, not the old two-clause sentence — the page is
      // scan-oriented, and a single line keeps the whole header low.
      description="قراردادهای حقوقی موردنیاز شما"
    />
  );
}
