"use client";

// ============================================================
// LEGALIR — Lawyer Filters Bottom Sheet
// ============================================================
// The mobile home for the advanced filters (category, sort, remote-only).
// It is a bottom sheet — not the side `Drawer` — because on a phone the
// thumb reaches the bottom edge, and the sheet rises from there.
//
// The sheet is a controlled draft: edits are local until «اعمال فیلترها»
// is pressed, so the list never re-queries on every tap. «پاک کردن» resets
// the draft to the defaults. Only filters the backend actually supports
// are exposed (category / sort / remoteOnly).
// ============================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LawyerListFilters } from "@legalir/types";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { IconClose, IconFilter } from "@/lib/icons";
import { Select, Checkbox } from "@legalir/ui";

export type LawyerSort = NonNullable<LawyerListFilters["sort"]>;

export interface LawyerFilterValues {
  category: string;
  sort: LawyerSort;
  remoteOnly: boolean;
}

interface LawyerFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  value: LawyerFilterValues;
  onApply: (next: LawyerFilterValues) => void;
}

const SORT_OPTIONS: { value: LawyerSort; label: string }[] = [
  { value: "relevance", label: "مرتبط‌ترین" },
  { value: "rating", label: "بیشترین امتیاز" },
  { value: "experience", label: "بیشترین سابقه" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "همه تخصص‌ها" },
  ...Object.entries(LEGAL_CATEGORY_FA).map(([value, label]) => ({ value, label })),
];

export function LawyerFiltersSheet({
  open,
  onClose,
  value,
  onApply,
}: LawyerFiltersSheetProps) {
  const [draft, setDraft] = useState<LawyerFilterValues>(value);

  // Re-seed the draft each time the sheet opens so it always reflects the
  // filters currently applied to the list.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div
        className="absolute inset-0 bg-scrim/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="فیلترهای وکلا"
        className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4">
          <div className="flex items-center gap-2">
            <IconFilter size={20} className="text-primary" />
            <h2 className="text-h3 text-on-surface">فیلترها</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-5 py-5">
          <Select
            label="حوزه تخصصی"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            options={CATEGORY_OPTIONS}
            fullWidth
          />

          <Select
            label="ترتیب نمایش"
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value as LawyerSort }))}
            options={SORT_OPTIONS}
            fullWidth
          />

          <Checkbox
            label="فقط مشاوره آنلاین"
            checked={draft.remoteOnly}
            onChange={(e) => setDraft((d) => ({ ...d, remoteOnly: e.target.checked }))}
            className="text-body-2 text-on-surface"
          />
        </div>

        {/* Footer — safe-area aware so the buttons clear the home indicator */}
        <div
          className="flex gap-3 border-t border-divider px-5 pt-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={() => setDraft({ category: "", sort: "relevance", remoteOnly: false })}
            className="flex-1 rounded-xl border border-divider/60 bg-surface px-4 py-3 text-button font-medium text-on-surface transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            پاک کردن
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
          >
            اعمال فیلترها
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
