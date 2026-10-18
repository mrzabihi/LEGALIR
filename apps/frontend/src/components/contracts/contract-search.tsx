// ============================================================
// LEGALIR — Contract search card
// ============================================================
// The search surface sits BELOW the two product-path cards and above the
// template library. It is intentionally the quietest raised element on
// the page: searching templates is a secondary act, so the card carries
// no resting shadow and no permanent glow — only a thin outline that
// takes the primary color on focus.
//
// The input itself is the shared `SearchField` primitive (a real MD3
// outlined field with a real label, a leading glyph and a labelled clear
// button), so it can never drift from /cases and the other list
// surfaces. It renders at the compact 48px size: one short row, never a
// second toolbar.
//
// On phones the card also hosts the filter trigger for the contract
// list, because filters belong beside search rather than in their own
// row.
// ============================================================

"use client";

import { Button } from "@legalir/ui";
import { IconFilter } from "@/lib/icons";
import { SearchField } from "@/components/shared";

interface ContractSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called when the user submits (Enter) — used for the analytics ping. */
  onSubmit?: () => void;
  /** Opens the filter drawer. When omitted, no filter trigger is shown. */
  onOpenFilters?: () => void;
  /** Number of active finer filters — shown as a count on the trigger. */
  filterCount?: number;
  className?: string;
}

export function ContractSearch({
  value,
  onChange,
  placeholder = "جست‌وجو در نام یا کلیدواژهٔ قرارداد؛ مثلاً اجاره، NDA",
  onSubmit,
  onOpenFilters,
  filterCount = 0,
  className = "",
}: ContractSearchProps) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface px-1 py-0.5",
        "transition-[border-color,box-shadow] duration-short3 ease-standard",
        "focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--color-primary)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-1">
        <SearchField
          label="جستجوی قرارداد"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          inputSize="small"
          // The card supplies its own chrome, so the field's reserved empty
          // helper row would only be dead height.
          reserveMessageSpace={false}
        />
      </div>

      {onOpenFilters && (
        <Button
          type="button"
          variant="text"
          size="small"
          onClick={onOpenFilters}
          startIcon={<IconFilter size={18} />}
          className="tablet:hidden relative shrink-0"
        >
          فیلترها
          {filterCount > 0 && (
            <span className="ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on">
              {filterCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
