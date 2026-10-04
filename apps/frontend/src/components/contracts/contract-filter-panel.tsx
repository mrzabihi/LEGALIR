// ============================================================
// LEGALIR — Contract filter panel (the finer axes)
// ============================================================
// The controls that do NOT fit on the one-row desktop bar live here,
// and the SAME panel is rendered inside the desktop «فیلترهای بیشتر»
// dialog and the mobile filter drawer. One component, two hosts, so
// the two can never drift apart.
//
// The axes, in the order the user thinks about them:
//   1. وضعیت پیش‌نویس  — the DRAFT axis (multi-select)
//   2. وضعیت بررسی    — the ANALYSIS axis (multi-select)
//   3. نوع قرارداد     — the contract type (multi-select)
//   4. بازه زمانی      — recency on `updatedAt` (single)
//
// Multi-select groups combine with OR inside the group and AND against
// the other groups (spec §6). The panel only edits state; the page
// applies it.
// ============================================================

"use client";

import { SelectableOption, Select } from "@legalir/ui";
import {
  CONTRACT_ANALYSIS_STATUS_LABELS,
  CONTRACT_ANALYSIS_STATUS_ORDER,
  CONTRACT_DRAFT_STATUS_LABELS,
  CONTRACT_DRAFT_STATUS_ORDER,
  type ContractAnalysisStatus,
  type ContractDraftStatus,
} from "@/lib/contracts/status";
import {
  CONTRACT_DATE_RANGE_LABELS,
  CONTRACT_DATE_RANGE_ORDER,
  type ContractDateRange,
  type ContractFilterState,
} from "@/lib/contracts/filters";

interface ContractFilterPanelProps {
  filters: ContractFilterState;
  onChange: (next: ContractFilterState) => void;
  /** The distinct types present in the list, for the type control. */
  typeOptions: { value: string; labelFa: string }[];
}

/** Toggle one value inside a multi-select group. */
function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ContractFilterPanel({ filters, onChange, typeOptions }: ContractFilterPanelProps) {
  return (
    <div className="space-y-6">
      {/* 1. Draft axis */}
      <fieldset>
        <legend className="mb-2 text-labelLarge text-on-surface">وضعیت پیش‌نویس</legend>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_DRAFT_STATUS_ORDER.map((key: ContractDraftStatus) => (
            <SelectableOption
              key={key}
              label={CONTRACT_DRAFT_STATUS_LABELS[key]}
              selected={filters.draft.includes(key)}
              onClick={() => onChange({ ...filters, draft: toggle(filters.draft, key) })}
              showTick={false}
              className="h-9 px-3.5 text-labelMedium"
            />
          ))}
        </div>
      </fieldset>

      {/* 2. Analysis axis */}
      <fieldset>
        <legend className="mb-2 text-labelLarge text-on-surface">وضعیت بررسی هوش مصنوعی</legend>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_ANALYSIS_STATUS_ORDER.map((key: ContractAnalysisStatus) => (
            <SelectableOption
              key={key}
              label={CONTRACT_ANALYSIS_STATUS_LABELS[key]}
              selected={filters.analysis.includes(key)}
              onClick={() => onChange({ ...filters, analysis: toggle(filters.analysis, key) })}
              showTick={false}
              className="h-9 px-3.5 text-labelMedium"
            />
          ))}
        </div>
      </fieldset>

      {/* 3. Type */}
      <fieldset>
        <legend className="mb-2 text-labelLarge text-on-surface">نوع قرارداد</legend>
        {typeOptions.length === 0 ? (
          <p className="text-caption text-muted">هنوز قراردادی از هیچ نوعی ثبت نشده است.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((opt) => (
              <SelectableOption
                key={opt.value}
                label={opt.labelFa}
                selected={filters.types.includes(opt.value)}
                onClick={() => onChange({ ...filters, types: toggle(filters.types, opt.value) })}
                showTick={false}
                className="h-9 px-3.5 text-labelMedium"
              />
            ))}
          </div>
        )}
      </fieldset>

      {/* 4. Recency */}
      <Select
        id="contract-date-range"
        label="بازه زمانی آخرین تغییر"
        value={filters.dateRange}
        onChange={(e) =>
          onChange({ ...filters, dateRange: e.target.value as ContractDateRange })
        }
        fullWidth
        options={CONTRACT_DATE_RANGE_ORDER.map((key) => ({
          value: key,
          label: CONTRACT_DATE_RANGE_LABELS[key],
        }))}
      />
    </div>
  );
}
