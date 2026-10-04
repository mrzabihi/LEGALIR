// ============================================================
// LEGALIR — Contracts page header
// ============================================================
// The page's own header, not the generic service header. The
// Contracts page hosts TWO services that must never be confused:
//
//   • تنظیم پیش‌نویس  — build a new contract from a template
//   • بررسی قرارداد   — have an EXISTING contract analysed by AI
//
// So the header states the page's job in one sentence and offers the
// two entry points as a primary and a secondary action. The primary
// action scrolls to the template library (the page's own first
// section) rather than navigating away, so the user never loses the
// page they are on.
// ============================================================

"use client";

import Link from "next/link";
import { Button } from "@legalir/ui";
import { IconChevronRight, IconFilePen, IconFileSearch } from "@/lib/icons";

interface ContractsPageHeaderProps {
  /** Scrolls to the template library (SECTION 1). */
  onStartNew: () => void;
}

export function ContractsPageHeader({ onStartNew }: ContractsPageHeaderProps) {
  return (
    <header className="mb-6">
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
              تنظیم پیش‌نویس و قراردادهای من
            </span>
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start laptop:justify-between laptop:gap-8">
        <div className="min-w-0">
          <h1 className="text-h2 font-bold text-on-surface">تنظیم پیش‌نویس و قراردادهای من</h1>
          <p className="mt-2 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
            قرارداد تازه بسازید، پیش‌نویس‌های خود را تکمیل کنید و برای بررسی به هوش مصنوعی لیگالیر
            بسپارید.
          </p>
        </div>

        {/* The two entry points. The primary builds; the secondary
            reviews. They are visually distinct so the two services are
            never mistaken for one another. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="filled"
            size="large"
            startIcon={<IconFilePen size={20} />}
            onClick={onStartNew}
          >
            تنظیم پیش‌نویس جدید
          </Button>
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
