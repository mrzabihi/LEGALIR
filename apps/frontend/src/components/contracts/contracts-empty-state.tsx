// ============================================================
// LEGALIR — Contracts empty states
// ============================================================
// Two distinct empty states, because they need different actions:
//   • no-contracts — the user has never built one; offer to start.
//   • no-results   — filters/search excluded everything; offer to
//                    clear them rather than to start from scratch.
// ============================================================

"use client";

import { Button } from "@legalir/ui";
import { IconContract, IconSearch } from "@/lib/icons";

interface ContractsEmptyStateProps {
  variant: "no-contracts" | "no-results";
  onClearFilters?: () => void;
  onStart?: () => void;
}

export function ContractsEmptyState({
  variant,
  onClearFilters,
  onStart,
}: ContractsEmptyStateProps) {
  const isNoResults = variant === "no-results";

  return (
    <div
      className="flex flex-col items-center justify-center rounded-large border border-divider bg-surface px-4 py-12 text-center"
      role="status"
    >
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-muted">
        {isNoResults ? <IconSearch size={28} /> : <IconContract size={28} />}
      </span>

      <h3 className="text-titleMedium text-on-surface">
        {isNoResults ? "قراردادی با این شرایط پیدا نشد" : "هنوز قراردادی نساخته‌اید"}
      </h3>
      <p className="mt-1 max-w-sm text-body-2 text-muted">
        {isNoResults
          ? "فیلترها یا عبارت جستجو را تغییر دهید تا نتایج بیشتری ببینید."
          : "از میان قالب‌های بالا یکی را انتخاب کنید و در چند دقیقه پیش‌نویس قرارداد خود را بسازید."}
      </p>

      <div className="mt-6 flex items-center gap-3">
        {isNoResults && onClearFilters && (
          <Button variant="outlined" onClick={onClearFilters}>
            پاک کردن فیلترها
          </Button>
        )}
        {!isNoResults && onStart && (
          <Button variant="filled" onClick={onStart}>
            ساخت قرارداد
          </Button>
        )}
      </div>
    </div>
  );
}
