"use client";

// ============================================================
// LEGALIR — Lawyer Filters Bottom Sheet
// ============================================================
// The mobile home for the FULL marketplace filter set: taxonomy specialties
// (multi-select, with a dependent sub-specialty row), professional rank,
// issuing organisation, province + city (dependent), experience band, rating,
// offered services, and the availability toggles (online / accepting clients).
//
// It is a bottom sheet — not the side `Drawer` — because on a phone the thumb
// reaches the bottom edge. The sheet is a controlled draft: edits are local
// until «اعمال فیلترها» is pressed, so the list never re-queries on every tap.
//
// Only filters the backend actually supports are exposed (every field here
// maps 1:1 onto `LawyerSearchFilters`, which `queryLawyers` honours).
// ============================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LawyerListFilters } from "@legalir/types";
import {
  LAWYER_PROFESSIONAL_RANKS,
  LAWYER_PROFESSIONAL_RANK_FA,
  LAWYER_ORGANIZATION_TYPES,
  LAWYER_ORGANIZATION_TYPE_FA,
  LAWYER_EXPERIENCE_BANDS,
  LAWYER_SERVICES,
  IRAN_PROVINCES,
  taxonomyDomains,
  taxonomyChildren,
  type LawyerProfessionalRank,
  type LawyerOrganizationType,
} from "@legalir/types";
import { IconClose, IconFilter } from "@/lib/icons";
import { Select, Checkbox } from "@legalir/ui";

export type LawyerSort = NonNullable<LawyerListFilters["sort"]>;

export interface LawyerFilterValues {
  /** Taxonomy node ids (domains, specialties or deeper) — any-of. */
  specialtyIds: string[];
  professionalRanks: LawyerProfessionalRank[];
  organizationTypes: LawyerOrganizationType[];
  province: string;
  city: string;
  experienceBand: string;
  minRating: number | null;
  serviceIds: string[];
  onlineOnly: boolean;
  acceptingClientsOnly: boolean;
  sort: LawyerSort;
}

export const EMPTY_LAWYER_FILTERS: LawyerFilterValues = {
  specialtyIds: [],
  professionalRanks: [],
  organizationTypes: [],
  province: "",
  city: "",
  experienceBand: "",
  minRating: null,
  serviceIds: [],
  onlineOnly: false,
  acceptingClientsOnly: false,
  sort: "relevance",
};

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

const RATING_OPTIONS = [
  { value: "", label: "همه امتیازها" },
  { value: "3", label: "۳ ستاره و بالاتر" },
  { value: "4", label: "۴ ستاره و بالاتر" },
  { value: "4.5", label: "۴.۵ ستاره و بالاتر" },
];

const EXPERIENCE_OPTIONS = [
  { value: "", label: "همه سوابق" },
  ...LAWYER_EXPERIENCE_BANDS.map((b) => ({ value: b.id, label: b.nameFa })),
];

/** Toggle one value in/out of a list (immutably). */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "shrink-0 rounded-full border px-3 py-1.5 text-caption font-medium transition-all",
        selected
          ? "border-control-selected-border bg-control-selected-surface text-control-selected"
          : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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

  const domains = taxonomyDomains();
  // The dependent sub-specialty row: children (SPECIALTY level) of every
  // selected domain. A user who picks «خانواده» then narrows to «طلاق».
  const dependentSpecialties = draft.specialtyIds.flatMap((id) => taxonomyChildren(id));
  const province = IRAN_PROVINCES.find((p) => p.nameFa === draft.province);
  const cityOptions = province
    ? [{ value: "", label: "همه شهرها" }, ...province.cities.map((c) => ({ value: c, label: c }))]
    : [{ value: "", label: "ابتدا استان را انتخاب کنید" }];

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
        className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24"
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

        {/* Body — scrollable */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {/* Specialties (domain → dependent specialty) */}
          <section>
            <h3 className="mb-2 text-body-2 font-semibold text-on-surface">حوزه تخصصی</h3>
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => (
                <Chip
                  key={d.id}
                  selected={draft.specialtyIds.includes(d.id)}
                  onClick={() =>
                    setDraft((s) => ({ ...s, specialtyIds: toggle(s.specialtyIds, d.id) }))
                  }
                >
                  {d.nameFa}
                </Chip>
              ))}
            </div>

            {dependentSpecialties.length > 0 && (
              <div className="mt-3 rounded-xl border border-divider/60 bg-surface-container/40 p-3">
                <p className="mb-2 text-caption text-muted">زیرتخصص</p>
                <div className="flex flex-wrap gap-2">
                  {dependentSpecialties.map((s) => (
                    <Chip
                      key={s.id}
                      selected={draft.specialtyIds.includes(s.id)}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          specialtyIds: toggle(prev.specialtyIds, s.id),
                        }))
                      }
                    >
                      {s.nameFa}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Rank */}
          <section>
            <h3 className="mb-2 text-body-2 font-semibold text-on-surface">نوع پروانه</h3>
            <div className="flex flex-wrap gap-2">
              {LAWYER_PROFESSIONAL_RANKS.map((r) => (
                <Chip
                  key={r}
                  selected={draft.professionalRanks.includes(r)}
                  onClick={() =>
                    setDraft((s) => ({ ...s, professionalRanks: toggle(s.professionalRanks, r) }))
                  }
                >
                  {LAWYER_PROFESSIONAL_RANK_FA[r]}
                </Chip>
              ))}
            </div>
          </section>

          {/* Organisation */}
          <section>
            <h3 className="mb-2 text-body-2 font-semibold text-on-surface">سازمان صدور پروانه</h3>
            <div className="flex flex-wrap gap-2">
              {LAWYER_ORGANIZATION_TYPES.map((o) => (
                <Chip
                  key={o}
                  selected={draft.organizationTypes.includes(o)}
                  onClick={() =>
                    setDraft((s) => ({ ...s, organizationTypes: toggle(s.organizationTypes, o) }))
                  }
                >
                  {LAWYER_ORGANIZATION_TYPE_FA[o]}
                </Chip>
              ))}
            </div>
          </section>

          {/* Geography */}
          <section className="flex flex-col gap-3">
            <h3 className="text-body-2 font-semibold text-on-surface">موقعیت</h3>
            <Select
              label="استان"
              value={draft.province}
              onChange={(e) => setDraft((s) => ({ ...s, province: e.target.value, city: "" }))}
              options={[
                { value: "", label: "همه استان‌ها" },
                ...IRAN_PROVINCES.map((p) => ({ value: p.nameFa, label: p.nameFa })),
              ]}
              fullWidth
            />
            <Select
              label="شهر"
              value={draft.city}
              onChange={(e) => setDraft((s) => ({ ...s, city: e.target.value }))}
              options={cityOptions}
              disabled={!province}
              fullWidth
            />
          </section>

          {/* Experience + rating */}
          <section className="flex flex-col gap-3">
            <Select
              label="سابقه کار"
              value={draft.experienceBand}
              onChange={(e) => setDraft((s) => ({ ...s, experienceBand: e.target.value }))}
              options={EXPERIENCE_OPTIONS}
              fullWidth
            />
            <Select
              label="حداقل امتیاز"
              value={draft.minRating === null ? "" : String(draft.minRating)}
              onChange={(e) =>
                setDraft((s) => ({
                  ...s,
                  minRating: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              options={RATING_OPTIONS}
              fullWidth
            />
          </section>

          {/* Services */}
          <section>
            <h3 className="mb-2 text-body-2 font-semibold text-on-surface">خدمات</h3>
            <div className="flex flex-wrap gap-2">
              {LAWYER_SERVICES.map((svc) => (
                <Chip
                  key={svc.id}
                  selected={draft.serviceIds.includes(svc.id)}
                  onClick={() =>
                    setDraft((s) => ({ ...s, serviceIds: toggle(s.serviceIds, svc.id) }))
                  }
                >
                  {svc.nameFa}
                </Chip>
              ))}
            </div>
          </section>

          {/* Availability */}
          <section className="flex flex-col gap-3">
            <h3 className="text-body-2 font-semibold text-on-surface">دسترس‌پذیری</h3>
            <Checkbox
              label="پذیرش موکل جدید"
              checked={draft.acceptingClientsOnly}
              onChange={(e) =>
                setDraft((s) => ({ ...s, acceptingClientsOnly: e.target.checked }))
              }
              className="text-body-2 text-on-surface"
            />
            <Checkbox
              label="ارائه مشاوره آنلاین"
              checked={draft.onlineOnly}
              onChange={(e) => setDraft((s) => ({ ...s, onlineOnly: e.target.checked }))}
              className="text-body-2 text-on-surface"
            />
          </section>

          {/* Sort */}
          <Select
            label="ترتیب نمایش"
            value={draft.sort}
            onChange={(e) => setDraft((s) => ({ ...s, sort: e.target.value as LawyerSort }))}
            options={SORT_OPTIONS}
            fullWidth
          />
        </div>

        {/* Footer — safe-area aware so the buttons clear the home indicator */}
        <div
          className="flex gap-3 border-t border-divider px-5 pt-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={() => setDraft(EMPTY_LAWYER_FILTERS)}
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
