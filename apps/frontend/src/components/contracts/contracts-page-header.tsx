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
// ============================================================

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveService } from "@/lib/services";
import { IconChevronRight, IconFilePen, IconFileSearch } from "@/lib/icons";

export function ContractsPageHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const service = resolveService(pathname, searchParams);
  const Icon = service?.icon;
  const title = service?.title ?? "تنظیم قرارداد";

  return (
    <header className="mb-5">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1.5 text-caption text-muted">
          <li>
            <Link
              href="/dashboard"
              className="rounded-small px-1 py-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              داشبورد
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center text-neutral-300">
            <IconChevronRight size={16} />
          </li>
          <li>
            <span aria-current="page" className="px-1 py-0.5 font-medium text-on-surface">
              {title}
            </span>
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start laptop:justify-between laptop:gap-8">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${service?.gradient} text-white shadow-elevation-1 mobile-l:flex`}
            >
              <Icon size={22} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-h2 font-bold text-on-surface">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
              قرارداد تازه بسازید، پیش‌نویس‌های خود را تکمیل کنید و خدمات قراردادی در دست توسعه را
              ببینید.
            </p>
          </div>
        </div>

        {/* The two entry points. The primary builds; the secondary
            reviews. They are visually distinct so the two services are
            never mistaken for one another. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/contracts/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-medium bg-primary px-6 text-labelLarge text-primary-on transition-colors hover:state-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 touch-target"
          >
            <IconFilePen size={20} aria-hidden="true" />
            تنظیم پیش‌نویس جدید
          </Link>
          <Link
            href="/contracts/review"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-medium border border-outline px-6 text-labelLarge text-primary transition-colors hover:state-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <IconFileSearch size={20} aria-hidden="true" />
            بررسی یک قرارداد
          </Link>
        </div>
      </div>
    </header>
  );
}
