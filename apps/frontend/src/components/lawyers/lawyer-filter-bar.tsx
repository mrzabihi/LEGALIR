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
import { Button, Chip, SegmentedControl, Select, Tooltip } from "@legalir/ui";
import { IconCheck, IconChevronLeft, IconChevronRightSmall, IconFilter } from "@/lib/icons";
import { SearchField } from "@/components/shared/search-field";
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

  // Selecting a chip adds a checkmark, which widens the rail without
  // resizing its box — the ResizeObserver above would not fire. Re-measure
  // so the paging arrows never sit disabled over real overflow.
  useEffect(() => {
    syncChipScroll();
  }, [activeDomainId, syncChipScroll]);

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
      // The same geometry as the shared `FilterChips` used by /history,
      // /cases and /documents: 36px, one row, identical border and
      // selected state. The rail keeps its own arrow paging because it
      // holds the taxonomy, but the chip itself must not be a second,
      // taller-looking design.
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-labelLarge transition-colors duration-short3 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
      selected
        ? "border-control-selected-border bg-control-selected-surface text-control-selected"
        : "border-[color:var(--color-outline-variant)] bg-surface text-on-surface-variant hover:bg-surface-hover hover:text-on-surface",
    ].join(" ");

  return (
    <section
      aria-label="فیلتر و جستجوی وکلا"
      className="mb-5 rounded-large border border-divider bg-surface p-3 shadow-elevation-1 tablet:p-4"
    >
      {/* Search + advanced trigger */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchField
            label="جستجوی وکیل"
            value={searchInput}
            onChange={onSearchInputChange}
            onEscape={onClearSearch}
            placeholder="نام وکیل، تخصص یا موضوع پرونده"
          />
        </div>
        <Tooltip content="فیلترهای بیشتر">
          {/* The count badge flows inline rather than overhanging the
              button: Button clips its own box for the state layer, so an
              absolutely-positioned badge outside it would be cut off. */}
          <Button
            type="button"
            variant="secondary"
            onClick={onOpenAdvanced}
            aria-label="فیلترهای بیشتر"
            startIcon={<IconFilter size={18} />}
            // Match the search field's 56px height so the pair reads as one
            // row rather than a tall field beside a short button.
            className="!h-14 shrink-0"
          >
            <span className="hidden mobile-l:inline">فیلترها</span>
            {quickFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-on">
                {toPersianNumber(quickFilterCount)}
              </span>
            )}
          </Button>
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
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
        >
          <IconChevronRightSmall size={18} />
        </button>

        <div
          ref={chipsRef}
          onScroll={syncChipScroll}
          // A single-select segmented filter, not a tab set: the rail
          // swaps the roster in place and there is no tabpanel to pair a
          // `tab` with. `group` + `radio` is the same contract the shared
          // `FilterChips` uses, and the selected chip carries a checkmark
          // so its state never depends on colour alone.
          role="group"
          aria-label="دسته‌بندی تخصص‌ها"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          <button
            type="button"
            role="radio"
            aria-checked={activeDomainId === ""}
            onClick={() => setDomain("")}
            className={chipClass(activeDomainId === "")}
          >
            {activeDomainId === "" && <IconCheck size={15} aria-hidden="true" />}
            همه
          </button>
          {DOMAINS.map((d) => {
            const selected = activeDomainId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDomain(d.id)}
                className={chipClass(selected)}
              >
                {selected && <IconCheck size={15} aria-hidden="true" />}
                {d.nameFa}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollChips("end")}
          disabled={!canScrollEnd}
          aria-label="نمایش دسته‌های بعدی"
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
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
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider pt-3">
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
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={onClearAll}
                className="ms-1 h-7 !px-2 text-caption"
              >
                پاک کردن همه
              </Button>
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
