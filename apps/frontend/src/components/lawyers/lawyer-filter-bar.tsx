"use client";

// ============================================================
// LEGALIR — Lawyer marketplace filter bar (quick filters)
// ============================================================
// The FIRST-level filter surface for the marketplace: a search field, the
// category rail, three quick controls (specialty, province, consultation
// type), the active-filter chips and a single "clear all". Everything the
// user needs to narrow the roster in a few seconds — the full attribute set
// (rank, licence, experience, rating, services…) stays one tap away in the
// advanced bottom sheet.
//
// Every control maps 1:1 onto `LawyerFilterValues` → `LawyerSearchFilters`;
// the taxonomy, province list and service catalogue all come from
// `@legalir/types`, so nothing here is hard-coded. The category rail drives
// the SAME `specialtyIds` the sheet edits — one source of truth.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IRAN_PROVINCES,
  LAWYER_EXPERIENCE_BANDS,
  LAWYER_ORGANIZATION_TYPE_FA,
  LAWYER_PROFESSIONAL_RANK_FA,
  lawyerServiceLabel,
  taxonomyByType,
  taxonomyChildren,
  taxonomyDomains,
  taxonomyLabel,
  taxonomyNode,
} from "@legalir/types";
import { Chip, SegmentedControl, Select, TextField, Tooltip } from "@legalir/ui";
import { IconChevronLeft, IconChevronRightSmall, IconFilter, IconSearch } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { type LawyerFilterValues } from "./lawyer-filters-sheet";

const DOMAINS = taxonomyDomains();

/** The in-person consultation service id (drives the «حضوری» quick filter). */
const IN_PERSON_SERVICE = "in_person_consult";

/** A single removable active-filter chip. */
interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface LawyerFilterBarProps {
  /** Debounced search value (used for the active-search chip). */
  search: string;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;
  filters: LawyerFilterValues;
  onFiltersChange: (next: LawyerFilterValues) => void;
  onOpenAdvanced: () => void;
  onClearAll: () => void;
  /** Total matching lawyers, when known. */
  resultCount: number;
  /** False until the first query resolves, so we don't flash a 0. */
  showResultCount: boolean;
}

export function LawyerFilterBar({
  search,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  filters,
  onFiltersChange,
  onOpenAdvanced,
  onClearAll,
  resultCount,
  showResultCount,
}: LawyerFilterBarProps) {
  // --- Category rail scroller (hidden scrollbar + arrow paging from tablet) ---
  const chipsRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const syncChipScroll = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL: scrollLeft runs 0 → -max, so compare magnitudes.
    const pos = Math.abs(el.scrollLeft);
    setCanScrollStart(pos > 1);
    setCanScrollEnd(pos < max - 1);
  }, []);

  useEffect(() => {
    syncChipScroll();
    const el = chipsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncChipScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncChipScroll]);

  const scrollChips = (dir: "start" | "end") => {
    const el = chipsRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.7, 160);
    el.scrollBy({ left: dir === "end" ? -step : step, behavior: "smooth" });
  };

  // --- Derived selections from the single source (`filters.specialtyIds`) ---
  const activeDomainId =
    filters.specialtyIds.find((id) => taxonomyNode(id)?.type === "DOMAIN") ?? "";
  const activeSpecialtyId =
    filters.specialtyIds.find((id) => {
      const node = taxonomyNode(id);
      return node !== undefined && node.type !== "DOMAIN";
    }) ?? "";

  // Specialty options follow the chosen category (its children); with no
  // category we fall back to the full specialty-level catalogue.
  const specialtyOptions = useMemo(() => {
    const nodes = activeDomainId ? taxonomyChildren(activeDomainId) : taxonomyByType("SPECIALTY");
    return [
      { value: "", label: "همه تخصص‌ها" },
      ...nodes.map((n) => ({ value: n.id, label: n.nameFa })),
    ];
  }, [activeDomainId]);

  const provinceOptions = useMemo(
    () => [
      { value: "", label: "همه استان‌ها" },
      ...IRAN_PROVINCES.map((p) => ({ value: p.nameFa, label: p.nameFa })),
    ],
    []
  );

  // --- Consultation type (derived from onlineOnly + the in-person service) ---
  const isOnline = filters.onlineOnly;
  const isInPerson = filters.serviceIds.includes(IN_PERSON_SERVICE);
  const consultType = isOnline && isInPerson
    ? "both"
    : isOnline
      ? "online"
      : isInPerson
        ? "in_person"
        : "all";

  const setConsultType = (type: string) => {
    const withoutInPerson = filters.serviceIds.filter((s) => s !== IN_PERSON_SERVICE);
    const next: LawyerFilterValues = { ...filters };
    switch (type) {
      case "online":
        next.onlineOnly = true;
        next.serviceIds = withoutInPerson;
        break;
      case "in_person":
        next.onlineOnly = false;
        next.serviceIds = [...withoutInPerson, IN_PERSON_SERVICE];
        break;
      case "both":
        next.onlineOnly = true;
        next.serviceIds = [...withoutInPerson, IN_PERSON_SERVICE];
        break;
      default:
        next.onlineOnly = false;
        next.serviceIds = withoutInPerson;
    }
    onFiltersChange(next);
  };

  // --- Mutators (all funnel through `onFiltersChange`) ---
  const setDomain = (id: string) =>
    onFiltersChange({ ...filters, specialtyIds: id ? [id] : [] });

  const setSpecialty = (id: string) => {
    // Keep the active domain (so the rail stays highlighted) and swap only
    // the specialty-level id.
    const base = activeDomainId ? [activeDomainId] : [];
    onFiltersChange({ ...filters, specialtyIds: id ? [...base, id] : base });
  };

  const setProvince = (province: string) => onFiltersChange({ ...filters, province, city: "" });

  // --- Active filter chips ---
  const chips = useMemo<ActiveChip[]>(() => {
    const list: ActiveChip[] = [];

    if (search) {
      list.push({ key: "search", label: `جستجو: ${search}`, onRemove: onClearSearch });
    }

    for (const id of filters.specialtyIds) {
      list.push({
        key: `specialty:${id}`,
        label: taxonomyLabel(id),
        onRemove: () =>
          onFiltersChange({
            ...filters,
            specialtyIds: filters.specialtyIds.filter((x) => x !== id),
          }),
      });
    }

    if (filters.province) {
      list.push({
        key: "province",
        label: filters.province,
        onRemove: () => onFiltersChange({ ...filters, province: "", city: "" }),
      });
    }
    if (filters.city) {
      list.push({
        key: "city",
        label: filters.city,
        onRemove: () => onFiltersChange({ ...filters, city: "" }),
      });
    }

    if (filters.onlineOnly) {
      list.push({
        key: "online",
        label: "مشاوره آنلاین",
        onRemove: () => onFiltersChange({ ...filters, onlineOnly: false }),
      });
    }
    if (filters.serviceIds.includes(IN_PERSON_SERVICE)) {
      list.push({
        key: "in_person",
        label: "مشاوره حضوری",
        onRemove: () =>
          onFiltersChange({
            ...filters,
            serviceIds: filters.serviceIds.filter((s) => s !== IN_PERSON_SERVICE),
          }),
      });
    }

    for (const rank of filters.professionalRanks) {
      list.push({
        key: `rank:${rank}`,
        label: LAWYER_PROFESSIONAL_RANK_FA[rank],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            professionalRanks: filters.professionalRanks.filter((x) => x !== rank),
          }),
      });
    }

    for (const org of filters.organizationTypes) {
      list.push({
        key: `org:${org}`,
        label: LAWYER_ORGANIZATION_TYPE_FA[org],
        onRemove: () =>
          onFiltersChange({
            ...filters,
            organizationTypes: filters.organizationTypes.filter((x) => x !== org),
          }),
      });
    }

    if (filters.experienceBand) {
      const band = LAWYER_EXPERIENCE_BANDS.find((b) => b.id === filters.experienceBand);
      list.push({
        key: "experience",
        label: band ? `سابقه ${band.nameFa}` : "سابقه کار",
        onRemove: () => onFiltersChange({ ...filters, experienceBand: "" }),
      });
    }

    if (filters.minRating !== null) {
      list.push({
        key: "rating",
        label: `امتیاز ${toPersianNumber(filters.minRating)} و بالاتر`,
        onRemove: () => onFiltersChange({ ...filters, minRating: null }),
      });
    }

    for (const svc of filters.serviceIds) {
      if (svc === IN_PERSON_SERVICE) continue; // already surfaced as «حضوری»
      list.push({
        key: `service:${svc}`,
        label: lawyerServiceLabel(svc),
        onRemove: () =>
          onFiltersChange({
            ...filters,
            serviceIds: filters.serviceIds.filter((x) => x !== svc),
          }),
      });
    }

    if (filters.acceptingClientsOnly) {
      list.push({
        key: "accepting",
        label: "پذیرش موکل جدید",
        onRemove: () => onFiltersChange({ ...filters, acceptingClientsOnly: false }),
      });
    }

    return list;
  }, [filters, search, onClearSearch, onFiltersChange]);

  const quickFilterCount =
    filters.specialtyIds.length +
    (filters.province ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.onlineOnly ? 1 : 0) +
    (filters.serviceIds.includes(IN_PERSON_SERVICE) ? 1 : 0);

  const chipClass = (selected: boolean) =>
    [
      "shrink-0 rounded-full border px-4 py-2 text-caption font-medium transition-all touch-target-min",
      selected
        ? "border-control-selected-border bg-control-selected-surface text-control-selected"
        : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
    ].join(" ");

  return (
    <section
      aria-label="فیلتر و جستجوی وکلا"
      className="mb-5 rounded-2xl border border-divider/60 bg-surface p-3 shadow-elevation-1 tablet:p-4"
    >
      {/* Search + advanced trigger */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            type="search"
            label="جستجوی وکیل"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="نام وکیل، تخصص یا موضوع پرونده را جستجو کنید…"
            leadingIcon={<IconSearch size={20} />}
            fullWidth
          />
        </div>
        <Tooltip content="فیلترهای بیشتر">
          <button
            type="button"
            onClick={onOpenAdvanced}
            aria-label="فیلترهای بیشتر"
            className="relative flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-divider/60 bg-surface px-3 text-body-2 font-medium text-on-surface transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <IconFilter size={18} />
            <span className="hidden mobile-l:inline">فیلترها</span>
            {quickFilterCount > 0 && (
              <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                {toPersianNumber(quickFilterCount)}
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Category rail — the دسته‌بندی filter */}
      <div className="mt-3 flex items-center gap-2">
        <span className="hidden shrink-0 text-caption font-medium text-muted tablet:inline">
          دسته‌بندی
        </span>
        <button
          type="button"
          onClick={() => scrollChips("start")}
          disabled={!canScrollStart}
          aria-label="نمایش دسته‌های قبلی"
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider/60 bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
        >
          <IconChevronRightSmall size={18} />
        </button>

        <div
          ref={chipsRef}
          onScroll={syncChipScroll}
          role="tablist"
          aria-label="دسته‌بندی تخصص‌ها"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeDomainId === ""}
            onClick={() => setDomain("")}
            className={chipClass(activeDomainId === "")}
          >
            همه
          </button>
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={activeDomainId === d.id}
              onClick={() => setDomain(d.id)}
              className={chipClass(activeDomainId === d.id)}
            >
              {d.nameFa}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollChips("end")}
          disabled={!canScrollEnd}
          aria-label="نمایش دسته‌های بعدی"
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider/60 bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
        >
          <IconChevronLeft size={18} />
        </button>
      </div>

      {/* Quick controls — specialty, province, consultation type */}
      <div className="mt-3 flex flex-col gap-3 tablet:flex-row tablet:flex-wrap tablet:items-center">
        <div className="tablet:w-56">
          <Select
            label="تخصص"
            value={activeSpecialtyId}
            onChange={(e) => setSpecialty(e.target.value)}
            options={specialtyOptions}
            selectSize="small"
            fullWidth
          />
        </div>
        <div className="tablet:w-44">
          <Select
            label="استان"
            value={filters.province}
            onChange={(e) => setProvince(e.target.value)}
            options={provinceOptions}
            selectSize="small"
            fullWidth
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="shrink-0 text-caption font-medium text-muted">نوع مشاوره</span>
          <SegmentedControl
            ariaLabel="نوع مشاوره"
            value={consultType}
            onChange={setConsultType}
            segments={[
              { value: "all", label: "همه" },
              { value: "online", label: "آنلاین" },
              { value: "in_person", label: "حضوری" },
              { value: "both", label: "هر دو" },
            ]}
          />
        </div>
      </div>

      {/* Active filters + result count */}
      {(chips.length > 0 || (showResultCount && resultCount > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider/60 pt-3">
          {chips.length > 0 && (
            <>
              <span className="text-caption font-medium text-muted">فیلترهای فعال:</span>
              {chips.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  variant="outlined"
                  selected
                  removable
                  onRemove={chip.onRemove}
                />
              ))}
              <button
                type="button"
                onClick={onClearAll}
                className="ms-1 rounded-full px-3 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                پاک کردن همه
              </button>
            </>
          )}
          {showResultCount && resultCount > 0 && (
            <span className="ms-auto text-caption text-muted">
              {toPersianNumber(resultCount)} وکیل پیدا شد
            </span>
          )}
        </div>
      )}
    </section>
  );
}
