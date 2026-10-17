// ============================================================
// LEGALIR — Compact «نیازمند ادامه» / «قراردادهای آماده» sections
// ============================================================
// On the full listing (/contracts/templates) the CONTRACT CATALOG is the
// page's subject; the user's own work is context. These two sections
// therefore render BELOW the catalog, with deliberately reduced weight:
//
//   • no raised card chrome — one flat surface, a small heading, and a
//     plain grid of `compact` user cards;
//   • a SMALL bounded preview (two rows) and one quiet link to the
//     hub's full workspace — never an endless grower;
//   • the same three hard states as everywhere else: loading (skeleton),
//     load failure (retry), and empty (one guidance line, no illustration).
//
// The data and the grouping come from the shared unified model, so the
// two surfaces can never disagree about what "needs work" means.
// ============================================================

"use client";

import Link from "next/link";
import { Button } from "@legalir/ui";
import type { UnifiedContract } from "@/lib/contracts/unified";
import { groupUnifiedContracts } from "@/lib/contracts/unified";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconArrowBack, IconRefresh } from "@/lib/icons";
import { UserContractCard } from "./user-contract-card";

/** Cards previewed per section — two complete rows at the widest grid. */
const PREVIEW_LIMIT = 6;

interface CompactContractSectionsProps {
  contracts: UnifiedContract[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Opens the delete-confirmation dialog (drafts only). */
  onDelete: (contract: UnifiedContract) => void;
  /** Copies a contract's reference code. */
  onCopyId: (contract: UnifiedContract) => void;
}

const SECTION_COPY: Record<string, { titleFa: string; hintFa: string; emptyFa: string }> = {
  "needs-work": {
    titleFa: "قراردادهای نیازمند ادامه",
    hintFa: "کارهایی که نیمه‌کاره مانده‌اند.",
    emptyFa: "قراردادی برای ادامه ندارید؛ همه قراردادهای شما تکمیل شده‌اند.",
  },
  ready: {
    titleFa: "قراردادهای آماده",
    hintFa: "متن آمادهٔ امضا یا ثبت رسمی.",
    emptyFa: "قراردادهای تکمیل‌شده پس از آماده شدن متن، در این بخش قرار می‌گیرند.",
  },
};

export function CompactContractSections({
  contracts,
  isLoading,
  isError,
  onRetry,
  onDelete,
  onCopyId,
}: CompactContractSectionsProps) {
  const grouped = groupUnifiedContracts(contracts);
  const hasAny = contracts.length > 0;

  return (
    <section
      aria-labelledby="my-compact-heading"
      className="mt-10 border-t border-divider pt-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="my-compact-heading" className="text-h4 text-on-surface">
            قراردادهای من
          </h2>
          <p className="mt-0.5 text-body-2 text-muted">
            {hasAny
              ? `${toPersianNumber(contracts.length)} قرارداد در حساب شما`
              : "کارهای در جریان و آمادهٔ شما، پس از شروع نخستین قرارداد اینجا نمایش داده می‌شوند."}
          </p>
        </div>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 rounded-small text-labelLarge font-medium text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          مدیریت همه قراردادها
          <IconArrowBack size={16} aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <div
          className="grid auto-rows-fr grid-cols-1 gap-2 tablet:grid-cols-2 laptop:grid-cols-3"
          aria-label="در حال بارگذاری قراردادهای من"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[92px] rounded-medium border border-divider bg-surface p-3"
            >
              <div className="h-4 w-32 rounded-small skeleton-shimmer" />
              <div className="mt-2 h-3 w-20 rounded-small skeleton-shimmer" />
              <div className="mt-3 h-1 w-full rounded-full skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-medium border border-divider bg-surface px-4 py-3"
        >
          <p className="text-body-2 text-on-surface-variant">
            بارگذاری قراردادهای شما ناموفق بود.
          </p>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onRetry}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : !hasAny ? (
        <p className="rounded-medium border border-divider bg-surface px-4 py-3 text-body-2 text-muted">
          هنوز قراردادی نساخته‌اید. یکی از قراردادهای بالا را انتخاب کنید تا فرایند تنظیم آغاز شود.
        </p>
      ) : (
        <div className="space-y-5">
          {(["needs-work", "ready"] as const).map((key) => {
            const copy = SECTION_COPY[key]!;
            const items = grouped.find((g) => g.key === key)?.contracts ?? [];
            const shown = items.slice(0, PREVIEW_LIMIT);
            const rest = items.length - shown.length;

            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-titleSmall text-on-surface-variant">{copy.titleFa}</h3>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-muted">
                    {toPersianNumber(items.length)}
                  </span>
                  {items.length > 0 && (
                    <span className="hidden text-caption text-muted tablet:inline">
                      — {copy.hintFa}
                    </span>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="text-caption text-muted">{copy.emptyFa}</p>
                ) : (
                  <>
                    <ul className="grid auto-rows-fr grid-cols-1 gap-2 tablet:grid-cols-2 laptop:grid-cols-3">
                      {shown.map((contract) => (
                        <li key={contract.id} className="h-full">
                          <UserContractCard
                            contract={contract}
                            layout="compact"
                            onDelete={onDelete}
                            onCopyId={onCopyId}
                          />
                        </li>
                      ))}
                    </ul>
                    {rest > 0 && (
                      <Link
                        href="/contracts"
                        className="mt-2 inline-flex items-center gap-1 rounded-small text-caption font-medium text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                      >
                        {toPersianNumber(rest)} قرارداد دیگر در قراردادهای فعال
                        <IconArrowBack size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
