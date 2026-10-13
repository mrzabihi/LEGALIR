// ============================================================
// LEGALIR — Contracts hub header
// ============================================================
// The shared header for the unified /contracts hub. It resolves the
// active service from the URL (the single source of truth) and is
// rendered ABOVE the two-tab switcher, so it stays pixel-identical when
// the user switches between «قراردادهای فعال» and «بزودی».
//
// The header hosts TWO services that must never be confused:
//
//   • تنظیم پیش‌نویس  — build a new contract from a template
//   • بررسی قرارداد   — have an EXISTING contract analysed by AI
//
// so it states the job in one sentence and offers the two entry points as
// a primary and a secondary action, both real navigations.
//
// It is a thin wrapper over the shared `PageIntroBanner`: the compact
// identity banner (breadcrumb + icon + title + description + actions) used
// across the product, so this page can never drift from the rest.
// ============================================================

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveService } from "@/lib/services";
import { IconFilePen, IconFileSearch } from "@/lib/icons";
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
      // The nav keeps its historical accessible name; `service-navigation`
      // asserts a navigation labelled «breadcrumb» on this route.
      breadcrumbAriaLabel="breadcrumb"
      breadcrumb={[{ label: "داشبورد", href: "/dashboard" }, { label: title }]}
      title={title}
      description="قرارداد تازه بسازید، پیش‌نویس‌های خود را تکمیل کنید و خدمات قراردادی در دست توسعه را ببینید."
      actions={
        <>
          <Link
            href="/contracts/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-labelLarge font-medium text-primary-on transition-colors duration-short3 hover:bg-primary-700 hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <IconFilePen size={20} aria-hidden="true" />
            تنظیم پیش‌نویس جدید
          </Link>
          <Link
            href="/contracts/review"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] px-5 text-labelLarge font-medium text-on-surface transition-colors duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <IconFileSearch size={20} aria-hidden="true" />
            بررسی یک قرارداد
          </Link>
        </>
      }
    />
  );
}
