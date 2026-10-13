// ============================================================
// LEGALIR — Contract search card
// ============================================================
// The single search surface that sits directly under the page title and
// ABOVE the view switcher. It is more than an input: it is a compact,
// raised CARD that frames the query and, on phones, hosts the filter
// trigger for the contracts list (filters live beside search, not in a
// second toolbar row — so the whole top of the page stays short).
//
// The input itself is the shared `SearchField` primitive, so the field —
// and its real label «جستجوی قرارداد» — can never drift from /cases and
// the other list surfaces. The query stays fully controlled by the page.
//
// The one decorative touch is the FOCUS glow on the card: a soft
// primary-tinted halo that appears only while the field is focused, and
// nowhere else on the page.
// ============================================================

"use client";

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
  placeholder = "جستجو در قراردادها...",
  onSubmit,
  onOpenFilters,
  filterCount = 0,
  className = "",
}: ContractSearchProps) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-2 shadow-elevation-1",
        "transition-[box-shadow,border-color] duration-short4 ease-standard",
        "focus-within:border-[color:color-mix(in_srgb,var(--color-primary)_40%,transparent)]",
        "focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_14%,transparent),0_6px_18px_-6px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]",
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
          // The card supplies its own chrome, so the field's reserved empty
          // helper row would only be dead height.
          reserveMessageSpace={false}
        />
      </div>

      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          className="tablet:hidden relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-medium border border-[color:var(--color-outline-variant)] px-3.5 text-labelLarge text-on-surface transition-colors duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <IconFilter size={18} aria-hidden="true" />
          فیلترها
          {filterCount > 0 && (
            <span className="ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on">
              {filterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
