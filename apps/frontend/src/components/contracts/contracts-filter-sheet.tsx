// ============================================================
// LEGALIR — Contracts filter sheet (mobile)
// ============================================================
// On mobile the status chips, the type dropdown and the sort control
// would push the contract list below the fold, so they live in a
// bottom sheet instead. The desktop filter bar renders the same
// controls inline; both read the same state, so the two can never
// disagree.
// ============================================================

"use client";

import { Drawer, Select } from "@legalir/ui";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_ORDER,
  type ContractStatusGroup,
} from "@/lib/contracts/status";
import { implementedContractDefinitions } from "@/lib/contracts/registry";

export type ContractSortKey = "updated" | "created" | "title";

export const CONTRACT_SORT_LABELS: Record<ContractSortKey, string> = {
  updated: "آخرین ویرایش",
  created: "تاریخ ایجاد",
  title: "الفبا",
};

interface ContractsFilterSheetProps {
  open: boolean;
  onClose: () => void;
  status: ContractStatusGroup | "all";
  onStatusChange: (status: ContractStatusGroup | "all") => void;
  type: string;
  onTypeChange: (type: string) => void;
  sort: ContractSortKey;
  onSortChange: (sort: ContractSortKey) => void;
  onClear: () => void;
}

export function ContractsFilterSheet({
  open,
  onClose,
  status,
  onStatusChange,
  type,
  onTypeChange,
  sort,
  onSortChange,
  onClear,
}: ContractsFilterSheetProps) {
  const definitions = implementedContractDefinitions();

  return (
    <Drawer open={open} onClose={onClose} title="فیلتر و مرتب‌سازی" width={320}>
      <div className="space-y-6">
        {/* Status */}
        <fieldset>
          <legend className="mb-2 text-labelLarge text-on-surface">وضعیت</legend>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="همه"
              selected={status === "all"}
              onClick={() => onStatusChange("all")}
            />
            {CONTRACT_STATUS_ORDER.map((key) => (
              <FilterChip
                key={key}
                label={CONTRACT_STATUS_LABELS[key]}
                selected={status === key}
                onClick={() => onStatusChange(key)}
              />
            ))}
          </div>
        </fieldset>

        {/* Type */}
        <Select
          id="contract-type-filter"
          label="نوع قرارداد"
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          placeholder="همه انواع"
          fullWidth
          options={definitions.map((def) => ({ value: def.id, label: def.typeFa }))}
        />

        {/* Sort */}
        <Select
          id="contract-sort"
          label="مرتب‌سازی"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ContractSortKey)}
          fullWidth
          options={(Object.keys(CONTRACT_SORT_LABELS) as ContractSortKey[]).map((key) => ({
            value: key,
            label: CONTRACT_SORT_LABELS[key],
          }))}
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClear}
            className="h-11 flex-1 rounded-medium border border-outline text-labelLarge text-primary transition-colors hover:state-hover"
          >
            پاک کردن
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-medium bg-primary text-labelLarge text-primary-on transition-colors hover:state-hover"
          >
            اعمال
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-labelMedium transition-colors ${
        selected
          ? "bg-primary text-primary-on"
          : "bg-surface-container text-on-surface hover:bg-surface-container-high"
      }`}
    >
      {label}
    </button>
  );
}
